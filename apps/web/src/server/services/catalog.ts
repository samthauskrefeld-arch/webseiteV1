import "server-only";
import { normalizeText, type QualificationKind } from "@myminijob/core";
import { db } from "../db";
import { notFound } from "../errors";

export interface QualificationHit {
  id: string;
  name: string;
  kind: QualificationKind;
  isOfficial: boolean;
  matchedAlias: string | null;
  score: number;
}

/**
 * Autocomplete over the qualification catalog: prefix, word-prefix, alias and trigram (typo) matching.
 * Aliases are only search helpers – the hit is always the canonical catalog entry.
 */
export async function searchQualifications(term: string, kinds?: QualificationKind[], limit = 10): Promise<QualificationHit[]> {
  const n = normalizeText(term);
  if (n.length < 2) return [];
  const kindFilter = kinds?.length ? kinds : null;
  const rows = await db().$queryRaw<Array<{ id: string; name: string; kind: QualificationKind; isOfficial: boolean; alias: string | null; score: number }>>`
    WITH input AS (SELECT ${n}::text AS n),
    candidates AS (
      SELECT q."id" AS qid, NULL::text AS alias,
        CASE WHEN q."normalizedName" = i.n THEN 1.0
             WHEN q."normalizedName" LIKE i.n || '%' THEN 0.9
             WHEN q."normalizedName" LIKE '% ' || i.n || '%' THEN 0.8
             WHEN q."normalizedName" LIKE '%' || i.n || '%' THEN 0.6
             ELSE similarity(q."normalizedName", i.n) END AS score
      FROM "Qualification" q, input i
      WHERE q."active" AND (q."normalizedName" LIKE '%' || i.n || '%' OR q."normalizedName" % i.n OR word_similarity(i.n, q."normalizedName") > 0.5)
      UNION ALL
      SELECT a."qualificationId", a."alias",
        CASE WHEN a."normalizedAlias" = i.n THEN 0.97
             WHEN a."normalizedAlias" LIKE i.n || '%' THEN 0.85
             WHEN a."normalizedAlias" LIKE '% ' || i.n || '%' THEN 0.7
             ELSE similarity(a."normalizedAlias", i.n) * 0.9 END
      FROM "QualificationAlias" a, input i
      WHERE a."normalizedAlias" LIKE '%' || i.n || '%' OR a."normalizedAlias" % i.n
    ),
    best AS (SELECT DISTINCT ON (qid) qid, alias, score FROM candidates ORDER BY qid, score DESC)
    SELECT q."id", q."name", q."kind", q."isOfficial", b.alias, b.score::float AS score
    FROM best b JOIN "Qualification" q ON q."id" = b.qid
    WHERE q."active" AND (${kindFilter}::text[] IS NULL OR q."kind"::text = ANY(${kindFilter}::text[]))
    ORDER BY b.score DESC, length(q."name") ASC
    LIMIT ${limit}`;
  return rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind, isOfficial: r.isOfficial, matchedAlias: r.alias, score: Number(r.score) }));
}

export async function getQualification(id: string) {
  const q = await db().qualification.findUnique({ where: { id }, include: { aliases: { select: { alias: true, kind: true } } } });
  if (!q) throw notFound("Qualifikation");
  return q;
}

export async function addAlias(qualificationId: string, alias: string, kind: "SYNONYM" | "ABBREVIATION" | "SPELLING" | "COLLOQUIAL", createdById: string) {
  await getQualification(qualificationId);
  return db().qualificationAlias.upsert({
    where: { qualificationId_normalizedAlias: { qualificationId, normalizedAlias: normalizeText(alias) } },
    create: { qualificationId, alias, normalizedAlias: normalizeText(alias), kind, createdById },
    update: { alias, kind },
  });
}

export async function catalogInfo() {
  const [imports, counts] = await Promise.all([
    db().catalogImport.findMany({ orderBy: { importedAt: "desc" }, take: 10 }),
    db().qualification.groupBy({ by: ["kind"], where: { active: true }, _count: true }),
  ]);
  return { imports, counts: counts.map((c) => ({ kind: c.kind, count: c._count })) };
}

// ---------------------------------------------------------------- places

export interface PlaceHit {
  id: string;
  name: string;
  postalCode: string | null;
  state: string;
  lat: number;
  lng: number;
}

export async function searchPlaces(term: string, limit = 8): Promise<PlaceHit[]> {
  const t = term.trim();
  if (/^\d{5}$/.test(t)) {
    return db().place.findMany({ where: { postalCode: t }, take: limit });
  }
  const n = normalizeText(t);
  if (n.length < 2) return [];
  return db().$queryRaw<PlaceHit[]>`
    SELECT "id", "name", "postalCode", "state", "lat", "lng" FROM "Place"
    WHERE "normalizedName" LIKE ${n} || '%' OR "normalizedName" % ${n}
    ORDER BY ("normalizedName" = ${n}) DESC, ("normalizedName" LIKE ${n} || '%') DESC, similarity("normalizedName", ${n}) DESC
    LIMIT ${limit}`;
}

/** Resolves a free-text place (city or PLZ) to coordinates; null when unknown (never guessed). */
export async function resolvePlace(term: string | null | undefined): Promise<PlaceHit | null> {
  if (!term?.trim()) return null;
  const t = term.trim();
  if (/^\d{5}$/.test(t)) return (await db().place.findFirst({ where: { postalCode: t } })) ?? null;
  const n = normalizeText(t);
  const exact = await db().place.findFirst({ where: { normalizedName: n } });
  if (exact) return exact;
  const hits = await searchPlaces(t, 1);
  const h = hits[0];
  return h && normalizeText(h.name).startsWith(n) ? h : null;
}

let placeNames: { set: Set<string>; at: number } | null = null;
/** Cached set of normalised place names for the rule-based search parser. */
export async function knownPlaceNames(): Promise<Set<string>> {
  if (placeNames && Date.now() - placeNames.at < 10 * 60_000) return placeNames.set;
  const rows = await db().place.findMany({ select: { normalizedName: true } });
  const set = new Set<string>();
  for (const r of rows) {
    set.add(r.normalizedName);
    set.add(r.normalizedName.split(" ")[0]!); // "frankfurt am main" -> "frankfurt"
  }
  placeNames = { set, at: Date.now() };
  return set;
}
