import "server-only";
import { Prisma } from "@myminijob/db";
import {
  CATEGORY_LABELS,
  describeQuery,
  EMPLOYMENT_LABELS,
  normalizeText,
  parseSearchRules,
  sanitizeAiQuery,
  type SearchQuery,
} from "@myminijob/core";
import { aiParseSearch } from "../adapters/ai";
import { db } from "../db";
import { knownPlaceNames, resolvePlace, searchQualifications } from "./catalog";
import { recordAiUsage, aiBudgetAvailable } from "./ai-usage";

export interface ParseResult {
  query: SearchQuery;
  parser: "rules" | "ai";
  chips: ReturnType<typeof describeQuery>;
}

/** Rule parser first (always works); AI refines when configured, budget allows, and its output passes validation. */
export async function parseNaturalQuery(input: string, opts: { clientKey: string; userId?: string | null; useAi?: boolean }): Promise<ParseResult> {
  const places = await knownPlaceNames();
  const rules = parseSearchRules(input, { isKnownPlace: (t) => places.has(t) });
  let query: SearchQuery = rules;
  let parser: "rules" | "ai" = "rules";
  if (opts.useAi !== false && input.trim().split(/\s+/).length >= 2 && (await aiBudgetAvailable(opts.clientKey, opts.userId))) {
    const ai = await aiParseSearch(input);
    if (ai) {
      await recordAiUsage(opts.clientKey, opts.userId, ai.usage);
      const clean = sanitizeAiQuery(ai.candidate, input);
      if (clean) {
        query = { ...rules, ...Object.fromEntries(Object.entries(clean).filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && !v.length))) };
        parser = "ai";
      }
    }
  }
  return {
    query,
    parser,
    chips: describeQuery(query, { category: query.category ? CATEGORY_LABELS[query.category] : undefined, employment: (t) => EMPLOYMENT_LABELS[t] }),
  };
}

export interface SearchHit {
  id: string;
  title: string;
  city: string | null;
  postalCode: string | null;
  remote: boolean;
  hourlyWageCents: number;
  employmentType: string;
  category: string;
  posterType: string;
  weekend: boolean;
  evening: boolean;
  positions: number;
  openPositions: number;
  publishedAt: Date;
  isDemo: boolean;
  businessName: string | null;
  businessVerified: boolean;
  /** Only present when both the query place and the listing have coordinates (city centre based). */
  distanceKm: number | null;
}

const DEFAULT_RADIUS_KM = 25;

/**
 * Executes a structured search against real, published listings only.
 * Location handling:
 *   - resolved place + radius  → distance filter (city-centre coordinates, labelled "ca.")
 *   - unresolved place          → name match on listing city/PLZ, no distances
 */
export async function searchListings(q: SearchQuery, page = 1, pageSize = 20) {
  const where: Prisma.Sql[] = [Prisma.sql`l."status" = 'PUBLISHED'`];
  let place: Awaited<ReturnType<typeof resolvePlace>> = null;
  let locationNote: string | null = null;

  if (q.text) {
    const n = normalizeText(q.text);
    where.push(Prisma.sql`(
      to_tsvector('german', l."title" || ' ' || l."description") @@ websearch_to_tsquery('german', ${q.text})
      OR mm_normalize(l."title") % ${n}
      OR mm_normalize(l."title" || ' ' || l."description") LIKE '%' || ${n} || '%'
      OR EXISTS (SELECT 1 FROM "ListingRequirement" r JOIN "Qualification" qq ON qq."id" = r."qualificationId"
                 WHERE r."listingId" = l."id" AND qq."normalizedName" LIKE '%' || ${n} || '%'))`);
  }
  if (q.category) where.push(Prisma.sql`l."category" = ${q.category}::"ListingCategory"`);
  if (q.minHourlyCents !== undefined) where.push(Prisma.sql`l."hourlyWageCents" >= ${q.minHourlyCents}`);
  if (q.employmentTypes?.length) where.push(Prisma.sql`l."employmentType"::text = ANY(${q.employmentTypes}::text[])`);
  if (q.weekend) where.push(Prisma.sql`l."weekend" = true`);
  if (q.evening) where.push(Prisma.sql`l."evening" = true`);
  if (q.remote) where.push(Prisma.sql`l."remote" = true`);
  if (q.qualificationKind) {
    where.push(Prisma.sql`EXISTS (SELECT 1 FROM "ListingRequirement" r JOIN "Qualification" qq ON qq."id" = r."qualificationId"
      WHERE r."listingId" = l."id" AND qq."kind"::text = ${q.qualificationKind})`);
  }
  if (q.qualificationTerms?.length) {
    const ids: string[] = [];
    for (const term of q.qualificationTerms) {
      const hit = (await searchQualifications(term, undefined, 1))[0];
      if (hit && hit.score >= 0.8) ids.push(hit.id);
    }
    if (ids.length) where.push(Prisma.sql`EXISTS (SELECT 1 FROM "ListingRequirement" r WHERE r."listingId" = l."id" AND r."qualificationId"::text = ANY(${ids}::text[]))`);
  }

  let distanceExpr = Prisma.sql`NULL::float`;
  if (q.location && !q.remote) {
    place = await resolvePlace(q.location);
    if (place) {
      distanceExpr = Prisma.sql`CASE WHEN l."lat" IS NULL OR l."lng" IS NULL THEN NULL ELSE
        2 * 6371 * asin(sqrt(power(sin(radians(l."lat" - ${place.lat}) / 2), 2) +
        cos(radians(${place.lat})) * cos(radians(l."lat")) * power(sin(radians(l."lng" - ${place.lng}) / 2), 2))) END`;
      const radius = q.radiusKm ?? DEFAULT_RADIUS_KM;
      where.push(Prisma.sql`(${distanceExpr} <= ${radius} OR (l."lat" IS NULL AND mm_normalize(l."city") = ${normalizeText(place.name)}))`);
    } else {
      locationNote = `„${q.location}“ ist nicht in unserem Ortsverzeichnis – wir suchen nach dem Ortsnamen, ohne Entfernungen.`;
      where.push(Prisma.sql`(mm_normalize(l."city") LIKE ${normalizeText(q.location)} || '%' OR l."postalCode" = ${q.location})`);
    }
  }

  const whereSql = Prisma.join(where, " AND ");
  const offset = (Math.max(1, page) - 1) * pageSize;
  const rankExpr = q.text ? Prisma.sql`ts_rank(to_tsvector('german', l."title" || ' ' || l."description"), websearch_to_tsquery('german', ${q.text}))` : Prisma.sql`0`;
  const orderSql = place ? Prisma.sql`distance_km ASC NULLS LAST, l."publishedAt" DESC` : q.text ? Prisma.sql`rank DESC, l."publishedAt" DESC` : Prisma.sql`l."publishedAt" DESC`;

  const [rows, countRows] = await Promise.all([
    db().$queryRaw<Array<SearchHit & { rank: number; distance_km: number | null; businessVerificationStatus: string | null; occupied: number }>>`
      SELECT l."id", l."title", l."city", l."postalCode", l."remote", l."hourlyWageCents", l."employmentType"::text AS "employmentType",
             l."category"::text AS "category", l."posterType"::text AS "posterType", l."weekend", l."evening", l."positions",
             l."publishedAt", l."isDemo", b."name" AS "businessName", b."verificationStatus"::text AS "businessVerificationStatus",
             ${distanceExpr} AS distance_km, ${rankExpr} AS rank,
             (SELECT count(*)::int FROM "MediationEvent" m WHERE m."listingId" = l."id" AND m."status" IN ('PENDING_APPLICANT','CONFIRMED','COMPLETED')) AS occupied
      FROM "Listing" l LEFT JOIN "Business" b ON b."id" = l."businessId"
      WHERE ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ${pageSize} OFFSET ${offset}`,
    db().$queryRaw<Array<{ total: number }>>`SELECT count(*)::int AS total FROM "Listing" l WHERE ${whereSql}`,
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      city: r.city,
      postalCode: r.postalCode,
      remote: r.remote,
      hourlyWageCents: r.hourlyWageCents,
      employmentType: r.employmentType,
      category: r.category,
      posterType: r.posterType,
      weekend: r.weekend,
      evening: r.evening,
      positions: r.positions,
      openPositions: Math.max(0, r.positions - Number(r.occupied)),
      publishedAt: r.publishedAt,
      isDemo: r.isDemo,
      businessName: r.businessName,
      businessVerified: r.businessVerificationStatus === "VERIFIED",
      distanceKm: r.distance_km === null || r.distance_km === undefined ? null : Math.round(Number(r.distance_km) * 10) / 10,
    })) satisfies SearchHit[],
    total: countRows[0]?.total ?? 0,
    page,
    pageSize,
    place: place ? { name: place.name, radiusKm: q.radiusKm ?? DEFAULT_RADIUS_KM } : null,
    locationNote,
  };
}
