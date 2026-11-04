import "server-only";
import {
  type ListingAction,
  type ListingInput,
  minimumWageCentsAt,
  nextListingStatus,
  PRIVATE_EMPLOYMENT_TYPES,
  SLOT_OCCUPYING,
  type ListingStatus,
} from "@myminijob/core";
import type { SessionUser } from "../auth/session";
import { requireVerified } from "../auth/session";
import { audit } from "../audit";
import { db } from "../db";
import { ApiError, forbidden, notFound } from "../errors";
import { rateLimit } from "../ratelimit";
import { resolvePlace } from "./catalog";

/** Phrases typical for scams (advance fees, off-platform payment requests). */
const SCAM_PATTERNS = [/vorkasse/i, /geb(ü|ue)hr\s+(vorab|im voraus)/i, /western\s*union/i, /gutschein(e|karten)?\s+(kaufen|schicken)/i, /\b(bitcoin|in\s+kryptow(ä|ae)hrung)\b/i, /ausweis(kopie)?\s+(vorab|schicken)/i];
const MAX_ACTIVE_LISTINGS = 30;

export const listingInclude = {
  requirements: { include: { qualification: { select: { id: true, name: true, kind: true, isOfficial: true } } } },
  business: { select: { id: true, name: true, verificationStatus: true, city: true, website: true, description: true } },
  owner: { select: { profile: { select: { username: true } } } },
} as const;

function validateBusinessRules(input: ListingInput) {
  if (input.posterType === "PRIVATE" && !PRIVATE_EMPLOYMENT_TYPES.includes(input.employmentType)) {
    throw new ApiError("VALIDATION", "Private Auftraggeber können nur einmalige Aufträge, Minijobs, befristete Tätigkeiten oder Projekte anbieten.", { employmentType: "Für Privat nicht verfügbar" });
  }
  const text = `${input.title} ${input.description} ${input.compensationNotes ?? ""} ${input.paymentNotes ?? ""}`;
  if (SCAM_PATTERNS.some((re) => re.test(text))) {
    throw new ApiError("VALIDATION", "Das Inserat enthält Formulierungen, die wir aus Sicherheitsgründen nicht zulassen (z. B. Vorkasse).", { description: "Unzulässige Formulierung" });
  }
}

export function wageWarnings(input: Pick<ListingInput, "hourlyWageCents" | "employmentType">) {
  const min = minimumWageCentsAt();
  const warnings: string[] = [];
  if (input.hourlyWageCents < min && !["AUSBILDUNG", "PRAKTIKUM"].includes(input.employmentType)) {
    warnings.push(
      `Der angegebene Stundenlohn liegt unter dem gesetzlichen Mindestlohn (${(min / 100).toFixed(2).replace(".", ",")} €). ` +
        "Für Arbeitnehmer ist das in der Regel unzulässig. Bitte prüfe dein Beschäftigungsverhältnis (allgemeine Information, keine Rechtsberatung).",
    );
  }
  return warnings;
}

async function resolveBusiness(user: SessionUser, input: ListingInput) {
  if (input.posterType !== "BUSINESS") return null;
  const business = await db().business.findFirst({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" } });
  if (!business) throw new ApiError("VALIDATION", "Für gewerbliche Inserate bitte zuerst ein Unternehmensprofil anlegen.", { posterType: "Unternehmensprofil fehlt" });
  return business;
}

async function validateRequirements(input: ListingInput) {
  const ids = input.requirements.map((r) => r.qualificationId).filter((x): x is string => !!x);
  if (!ids.length) return;
  const n = await db().qualification.count({ where: { id: { in: ids }, active: true } });
  if (n !== new Set(ids).size) throw new ApiError("VALIDATION", "Unbekannte Qualifikation in den Anforderungen");
}

function listingData(input: ListingInput, place: { lat: number; lng: number; name: string; postalCode: string | null } | null) {
  return {
    posterType: input.posterType,
    title: input.title,
    description: input.description,
    category: input.category,
    employmentType: input.employmentType,
    remote: input.remote,
    city: input.city ?? place?.name ?? null,
    postalCode: input.postalCode ?? null,
    lat: place?.lat ?? null,
    lng: place?.lng ?? null,
    startDate: input.startDate ? new Date(input.startDate) : null,
    endDate: input.endDate ? new Date(input.endDate) : null,
    hoursPerWeek: input.hoursPerWeek ?? null,
    hoursTotal: input.hoursTotal ?? null,
    scheduleText: input.scheduleText ?? null,
    weekend: input.weekend,
    evening: input.evening,
    positions: input.positions,
    hourlyWageCents: input.hourlyWageCents,
    compensationNotes: input.compensationNotes ?? null,
    paymentMethod: input.paymentMethod,
    paymentNotes: input.paymentNotes ?? null,
  };
}

export async function createListing(user: SessionUser, input: ListingInput) {
  await rateLimit(`listing-create:${user.id}`, 20, 86400);
  validateBusinessRules(input);
  const business = await resolveBusiness(user, input);
  await validateRequirements(input);
  const place = await resolvePlace(input.postalCode || input.city);
  const listing = await db().listing.create({
    data: {
      ...listingData(input, place),
      ownerId: user.id,
      businessId: business?.id ?? null,
      requirements: { create: input.requirements.map((r) => ({ type: r.type, level: r.level, qualificationId: r.qualificationId ?? null, text: r.text ?? null })) },
    },
    include: listingInclude,
  });
  await audit({ actorId: user.id, action: "listing.create", entityType: "Listing", entityId: listing.id });
  return { listing, warnings: wageWarnings(input), placeResolved: !!place || input.remote };
}

async function ownedListing(user: SessionUser, id: string) {
  const listing = await db().listing.findUnique({ where: { id } });
  if (!listing) throw notFound("Inserat");
  if (listing.ownerId !== user.id && !user.isAdmin) throw forbidden("Nur der Inseratsteller darf das Inserat ändern");
  return listing;
}

export async function occupiedSlots(listingId: string) {
  return db().mediationEvent.count({ where: { listingId, status: { in: SLOT_OCCUPYING } } });
}

export async function updateListing(user: SessionUser, id: string, input: ListingInput) {
  const listing = await ownedListing(user, id);
  if (listing.status === "ARCHIVED") throw new ApiError("CONFLICT", "Archivierte Inserate können nicht bearbeitet werden.");
  validateBusinessRules(input);
  const business = await resolveBusiness(user, input);
  await validateRequirements(input);
  const occupied = await occupiedSlots(id);
  if (input.positions < occupied) throw new ApiError("VALIDATION", `Es sind bereits ${occupied} Plätze vergeben.`, { positions: `Mindestens ${occupied}` });
  const place = await resolvePlace(input.postalCode || input.city);
  const updated = await db().$transaction(async (tx) => {
    await tx.listingRequirement.deleteMany({ where: { listingId: id } });
    return tx.listing.update({
      where: { id },
      data: {
        ...listingData(input, place),
        businessId: business?.id ?? null,
        requirements: { create: input.requirements.map((r) => ({ type: r.type, level: r.level, qualificationId: r.qualificationId ?? null, text: r.text ?? null })) },
      },
      include: listingInclude,
    });
  });
  await audit({ actorId: user.id, action: "listing.update", entityType: "Listing", entityId: id });
  return { listing: updated, warnings: wageWarnings(input), placeResolved: !!place || input.remote };
}

export async function changeListingStatus(user: SessionUser, id: string, action: ListingAction) {
  const listing = await ownedListing(user, id);
  const next = nextListingStatus(listing.status as ListingStatus, action);
  if (!next) throw new ApiError("CONFLICT", `Aktion „${action}“ ist im Status ${listing.status} nicht möglich.`);
  if (next === "PUBLISHED") {
    requireVerified(user);
    const active = await db().listing.count({ where: { ownerId: user.id, status: "PUBLISHED" } });
    if (active >= MAX_ACTIVE_LISTINGS) throw new ApiError("CONFLICT", `Maximal ${MAX_ACTIVE_LISTINGS} aktive Inserate gleichzeitig.`);
  }
  const updated = await db().listing.update({
    where: { id },
    data: { status: next, ...(action === "publish" ? { publishedAt: new Date() } : {}), ...(action === "close" ? { closedAt: new Date() } : {}) },
  });
  await audit({ actorId: user.id, action: `listing.${action}`, entityType: "Listing", entityId: id });
  return updated;
}

/** Public detail: only published (or paused/closed, read-only) listings; owners see their drafts. */
export async function getListing(id: string, viewer: SessionUser | null) {
  const listing = await db().listing.findUnique({ where: { id }, include: listingInclude });
  if (!listing) throw notFound("Inserat");
  const isOwner = viewer?.id === listing.ownerId;
  if (!isOwner && !viewer?.isAdmin && !["PUBLISHED", "PAUSED", "CLOSED"].includes(listing.status)) throw notFound("Inserat");
  const occupied = await occupiedSlots(id);
  const myApplication = viewer && !isOwner ? await db().application.findUnique({ where: { listingId_applicantId: { listingId: id, applicantId: viewer.id } }, select: { id: true, status: true } }) : null;
  const { ownerId, ...rest } = listing;
  return {
    ...rest,
    ownerUsername: listing.owner.profile?.username ?? null,
    isOwner,
    ownerId: isOwner ? ownerId : undefined,
    openPositions: Math.max(0, listing.positions - occupied),
    myApplication,
    warnings: isOwner ? wageWarnings(listing) : [],
  };
}

export async function listMyListings(userId: string) {
  const listings = await db().listing.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { applications: true } }, mediations: { where: { status: { in: SLOT_OCCUPYING } }, select: { id: true } } },
  });
  return listings.map(({ mediations, _count, ...l }) => ({ ...l, applicationCount: _count.applications, occupied: mediations.length }));
}

export async function latestListings(limit = 6) {
  return db().listing.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: cardSelect,
  });
}

export const cardSelect = {
  id: true,
  title: true,
  city: true,
  postalCode: true,
  remote: true,
  hourlyWageCents: true,
  employmentType: true,
  category: true,
  posterType: true,
  weekend: true,
  evening: true,
  positions: true,
  publishedAt: true,
  isDemo: true,
  business: { select: { name: true, verificationStatus: true } },
} as const;
