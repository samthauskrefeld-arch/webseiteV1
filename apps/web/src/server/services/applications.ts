import "server-only";
import { type ApplicationStatus, canTransitionApplication, SLOT_OCCUPYING } from "@myminijob/core";
import type { SessionUser } from "../auth/session";
import { requireVerified } from "../auth/session";
import { audit } from "../audit";
import { db } from "../db";
import { ApiError, conflict, forbidden, notFound } from "../errors";
import { rateLimit } from "../ratelimit";
import { notify } from "./notifications";
import { buildApplicationSnapshot } from "./profile";
import { expireStaleOffers } from "./mediation";

export async function isBlockedBetween(a: string, b: string) {
  return (await db().block.count({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } })) > 0;
}

/**
 * Submits an application exactly once. The idempotency key (from the slider/button) makes
 * retries safe: the same key returns the same application instead of creating a duplicate.
 */
export async function apply(user: SessionUser, listingId: string, input: { message: string; documentFileIds: string[] }, idempotencyKey: string) {
  if (!/^[\w-]{16,100}$/.test(idempotencyKey)) throw new ApiError("BAD_REQUEST", "Idempotency-Key fehlt oder ist ungültig");
  const sameKey = await db().application.findUnique({ where: { idempotencyKey } });
  if (sameKey) {
    if (sameKey.applicantId !== user.id || sameKey.listingId !== listingId) throw conflict("Idempotency-Key wurde bereits verwendet");
    return { application: sameKey, replayed: true };
  }
  requireVerified(user);
  await rateLimit(`apply:${user.id}`, 30, 3600);
  const listing = await db().listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== "PUBLISHED") throw notFound("Aktives Inserat");
  if (listing.ownerId === user.id) throw forbidden("Du kannst dich nicht auf dein eigenes Inserat bewerben.");
  if (await isBlockedBetween(user.id, listing.ownerId)) throw forbidden("Bewerbung nicht möglich.");
  const occupied = await db().mediationEvent.count({ where: { listingId, status: { in: SLOT_OCCUPYING } } });
  if (occupied >= listing.positions) throw conflict("Alle Plätze dieses Inserats sind bereits vergeben.");
  const existing = await db().application.findUnique({ where: { listingId_applicantId: { listingId, applicantId: user.id } } });
  if (existing) throw new ApiError("CONFLICT", "Du hast dich auf dieses Inserat bereits beworben.");

  const docs = [...new Set(input.documentFileIds)];
  if (docs.length) {
    const owned = await db().uploadedFile.count({ where: { id: { in: docs }, ownerId: user.id, deletedAt: null, purpose: { in: ["RESUME_DOC", "QUALIFICATION_PROOF"] } } });
    if (owned !== docs.length) throw forbidden("Unbekanntes Dokument");
  }
  const snapshot = await buildApplicationSnapshot(user.id);
  try {
    const application = await db().$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          listingId,
          applicantId: user.id,
          message: input.message,
          resumeSnapshot: snapshot,
          idempotencyKey,
          documents: { create: docs.map((fileId) => ({ fileId })) },
          events: { create: { actorId: user.id, toStatus: "submitted" } },
        },
      });
      await tx.conversation.create({
        data: { applicationId: app.id, participants: { create: [{ userId: user.id }, { userId: listing.ownerId }] } },
      });
      return app;
    });
    await audit({ actorId: user.id, action: "application.submit", entityType: "Application", entityId: application.id });
    await notify(listing.ownerId, "APPLICATION_RECEIVED", "Neue Bewerbung", `${user.username} hat sich auf „${listing.title}“ beworben.`, `/konto/inserate/${listingId}`);
    return { application, replayed: false };
  } catch (e) {
    // concurrent double-submit with the same key or same listing
    if ((e as { code?: string }).code === "P2002") {
      const again = await db().application.findUnique({ where: { idempotencyKey } });
      if (again) return { application: again, replayed: true };
      throw new ApiError("CONFLICT", "Du hast dich auf dieses Inserat bereits beworben.");
    }
    throw e;
  }
}

async function transition(appId: string, actorId: string | null, from: ApplicationStatus, to: ApplicationStatus, note?: string) {
  const res = await db().application.updateMany({ where: { id: appId, status: from }, data: { status: to } });
  if (res.count !== 1) throw conflict("Der Status hat sich zwischenzeitlich geändert. Bitte neu laden.");
  await db().applicationEvent.create({ data: { applicationId: appId, actorId, fromStatus: from, toStatus: to, note } });
}

async function loadForPoster(user: SessionUser, appId: string) {
  const app = await db().application.findUnique({ where: { id: appId }, include: { listing: true } });
  if (!app) throw notFound("Bewerbung");
  if (app.listing.ownerId !== user.id) throw forbidden();
  return app;
}

export async function getApplication(user: SessionUser, appId: string) {
  await expireStaleOffers();
  const app = await db().application.findUnique({
    where: { id: appId },
    include: {
      listing: { select: { id: true, title: true, ownerId: true, positions: true, status: true, hourlyWageCents: true, city: true, remote: true } },
      applicant: { select: { profile: { select: { username: true } } } },
      documents: { include: { file: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, scanStatus: true } } } },
      events: { orderBy: { createdAt: "asc" } },
      mediation: { include: { invoices: { select: { id: true, number: true, kind: true, status: true, grossCents: true } } } },
      conversation: { select: { id: true } },
    },
  });
  if (!app) throw notFound("Bewerbung");
  const isPoster = app.listing.ownerId === user.id;
  const isApplicant = app.applicantId === user.id;
  if (!isPoster && !isApplicant && !user.isAdmin) throw forbidden();
  if (isPoster && app.status === "submitted") {
    await transition(app.id, user.id, "submitted", "viewed");
    app.status = "viewed";
    await notify(app.applicantId, "APPLICATION_STATUS", "Bewerbung angesehen", `Deine Bewerbung auf „${app.listing.title}“ wurde angesehen.`, `/konto/bewerbungen`);
  }
  const { ownerId: _o, ...listing } = app.listing;
  return { ...app, listing, role: isPoster ? "poster" : isApplicant ? "applicant" : "admin", applicantUsername: app.applicant.profile?.username ?? "Gelöschtes Konto" };
}

export async function listMyApplications(userId: string) {
  await expireStaleOffers();
  return db().application.findMany({
    where: { applicantId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      listing: { select: { id: true, title: true, city: true, remote: true, hourlyWageCents: true, status: true, employmentType: true } },
      mediation: { select: { id: true, status: true, expiresAt: true, confirmedAt: true, posterCompletedAt: true, applicantCompletedAt: true } },
      conversation: { select: { id: true } },
    },
  });
}

export async function listApplicationsForListing(user: SessionUser, listingId: string) {
  await expireStaleOffers();
  const listing = await db().listing.findUnique({ where: { id: listingId } });
  if (!listing) throw notFound("Inserat");
  if (listing.ownerId !== user.id && !user.isAdmin) throw forbidden();
  const apps = await db().application.findMany({
    where: { listingId, status: { not: "withdrawn" } },
    orderBy: { createdAt: "asc" },
    include: {
      applicant: { select: { profile: { select: { username: true } } } },
      mediation: { select: { id: true, status: true, expiresAt: true, confirmedAt: true, posterCompletedAt: true, applicantCompletedAt: true } },
      documents: { select: { fileId: true } },
      conversation: { select: { id: true } },
    },
  });
  const occupied = await db().mediationEvent.count({ where: { listingId, status: { in: SLOT_OCCUPYING } } });
  return { listing: { id: listing.id, title: listing.title, positions: listing.positions, status: listing.status, occupied }, applications: apps.map((a) => ({ ...a, applicantUsername: a.applicant.profile?.username ?? "Gelöschtes Konto" })) };
}

export async function withdrawApplication(user: SessionUser, appId: string) {
  const app = await db().application.findUnique({ where: { id: appId }, include: { listing: true } });
  if (!app || app.applicantId !== user.id) throw notFound("Bewerbung");
  if (app.status === "accepted") throw conflict("Für eine Zusage bitte „Zusage ablehnen“ verwenden.");
  if (!canTransitionApplication(app.status as ApplicationStatus, "withdrawn", "applicant")) throw conflict("Bewerbung kann nicht mehr zurückgezogen werden.");
  await transition(app.id, user.id, app.status as ApplicationStatus, "withdrawn");
  await notify(app.listing.ownerId, "APPLICATION_STATUS", "Bewerbung zurückgezogen", `${user.username} hat die Bewerbung auf „${app.listing.title}“ zurückgezogen.`, `/konto/inserate/${app.listingId}`);
  return { status: "withdrawn" };
}

export async function shortlistApplication(user: SessionUser, appId: string) {
  const app = await loadForPoster(user, appId);
  if (!canTransitionApplication(app.status as ApplicationStatus, "shortlisted", "poster")) throw conflict("Nicht möglich im aktuellen Status.");
  await transition(app.id, user.id, app.status as ApplicationStatus, "shortlisted");
  await notify(app.applicantId, "APPLICATION_STATUS", "Engere Wahl", `Du bist für „${app.listing.title}“ in der engeren Wahl.`, `/konto/bewerbungen`);
  return { status: "shortlisted" };
}

export async function rejectApplication(user: SessionUser, appId: string, note?: string) {
  const app = await loadForPoster(user, appId);
  if (app.status === "accepted") throw conflict("Für eine ausgesprochene Zusage bitte „Zusage zurücknehmen“ verwenden.");
  if (!canTransitionApplication(app.status as ApplicationStatus, "rejected", "poster")) throw conflict("Nicht möglich im aktuellen Status.");
  await transition(app.id, user.id, app.status as ApplicationStatus, "rejected", note);
  await notify(app.applicantId, "APPLICATION_STATUS", "Absage", `Leider hat es für „${app.listing.title}“ nicht geklappt.`, `/konto/bewerbungen`);
  return { status: "rejected" };
}

export { transition as transitionApplication };
