import "server-only";
import type { z } from "zod";
import type { businessSchema, ReportTarget } from "@myminijob/core";
import type { SessionUser } from "../auth/session";
import { audit } from "../audit";
import { db } from "../db";
import { ApiError, conflict, forbidden, notFound } from "../errors";
import { rateLimit } from "../ratelimit";
import { notify } from "./notifications";

// ------------------------------------------------------------------ reviews
/**
 * Reviews require a COMPLETED mediation (both sides confirmed the job was done).
 * One review per side and mediation. Reviews with links are hidden for moderation.
 */
export async function createReview(user: SessionUser, mediationId: string, rating: number, text: string) {
  await rateLimit(`review:${user.id}`, 10, 86400);
  const m = await db().mediationEvent.findUnique({ where: { id: mediationId } });
  if (!m || (m.posterId !== user.id && m.applicantId !== user.id)) throw notFound("Vermittlung");
  if (m.status !== "COMPLETED") throw conflict("Bewertungen sind erst nach beidseitig bestätigtem Abschluss möglich.");
  const subjectId = m.posterId === user.id ? m.applicantId : m.posterId;
  const needsModeration = /(https?:\/\/|www\.|\b\S+@\S+\.\w+)/i.test(text);
  try {
    const review = await db().review.create({ data: { mediationEventId: m.id, authorId: user.id, subjectId, rating, text, status: needsModeration ? "HIDDEN" : "VISIBLE" } });
    await notify(subjectId, "REVIEW", "Neue Bewertung", `${user.username} hat dich bewertet.`, `/profil/${encodeURIComponent((await db().profile.findUnique({ where: { userId: subjectId } }))?.username ?? "")}`);
    return { review, moderated: needsModeration };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw conflict("Du hast diese Vermittlung bereits bewertet.");
    throw e;
  }
}

// ------------------------------------------------------------------ reports
export async function createReport(user: SessionUser, input: { targetType: ReportTarget; targetId: string; reason: string; details: string }) {
  await rateLimit(`report:${user.id}`, 20, 86400);
  const exists = await targetExists(input.targetType, input.targetId, user.id);
  if (!exists) throw notFound("Gemeldeter Inhalt");
  try {
    const r = await db().report.create({ data: { reporterId: user.id, ...input } });
    await audit({ actorId: user.id, action: "report.create", entityType: input.targetType, entityId: input.targetId });
    return r;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw conflict("Du hast diesen Inhalt bereits gemeldet.");
    throw e;
  }
}

async function targetExists(type: ReportTarget, id: string, reporterId: string) {
  switch (type) {
    case "LISTING":
      return !!(await db().listing.findUnique({ where: { id } }));
    case "USER":
      return !!(await db().user.findUnique({ where: { id } }));
    case "REVIEW":
      return !!(await db().review.findUnique({ where: { id } }));
    case "MESSAGE":
      // only messages the reporter could see
      return !!(await db().message.findFirst({ where: { id, conversation: { participants: { some: { userId: reporterId } } } } }));
  }
}

export async function listReports(status: "OPEN" | "ACTIONED" | "DISMISSED" = "OPEN") {
  return db().report.findMany({ where: { status }, orderBy: { createdAt: "asc" }, take: 100, include: { reporter: { select: { profile: { select: { username: true } } } } } });
}

/** Moderation decision (DSA: documented reason, affected user is informed). */
export async function resolveReport(admin: SessionUser, reportId: string, action: "dismiss" | "hide" | "suspend_user", resolution: string) {
  const r = await db().report.findUnique({ where: { id: reportId } });
  if (!r) throw notFound("Meldung");
  if (r.status !== "OPEN") throw conflict("Meldung ist bereits bearbeitet.");
  let affectedUserId: string | null = null;
  if (action === "hide") {
    if (r.targetType === "LISTING") {
      const l = await db().listing.update({ where: { id: r.targetId }, data: { status: "CLOSED", closedAt: new Date() } });
      affectedUserId = l.ownerId;
    } else if (r.targetType === "MESSAGE") {
      const m = await db().message.update({ where: { id: r.targetId }, data: { hiddenAt: new Date() } });
      affectedUserId = m.senderId;
    } else if (r.targetType === "REVIEW") {
      const rv = await db().review.update({ where: { id: r.targetId }, data: { status: "HIDDEN" } });
      affectedUserId = rv.authorId;
    } else throw new ApiError("BAD_REQUEST", "Personen können nicht ausgeblendet, nur gesperrt werden.");
  }
  if (action === "suspend_user") {
    const uid = r.targetType === "USER" ? r.targetId : null;
    if (!uid) throw new ApiError("BAD_REQUEST", "Sperren nur bei Meldungen zu Personen.");
    await db().user.update({ where: { id: uid }, data: { status: "SUSPENDED" } });
    await db().session.deleteMany({ where: { userId: uid } });
    affectedUserId = uid;
  }
  await db().report.update({ where: { id: r.id }, data: { status: action === "dismiss" ? "DISMISSED" : "ACTIONED", handledById: admin.id, handledAt: new Date(), resolution } });
  await audit({ actorId: admin.id, action: `moderation.${action}`, entityType: r.targetType, entityId: r.targetId, data: { reportId: r.id } });
  if (affectedUserId && action !== "dismiss") {
    await notify(affectedUserId, "SYSTEM", "Moderationsentscheidung", `Ein Inhalt von dir wurde nach einer Prüfung eingeschränkt. Begründung: ${resolution}. Du kannst über den Support widersprechen.`);
  }
}

// ------------------------------------------------------------------ business
export async function getMyBusiness(userId: string) {
  return db().business.findFirst({ where: { ownerId: userId }, orderBy: { createdAt: "asc" } });
}

export async function upsertMyBusiness(userId: string, input: z.infer<typeof businessSchema>) {
  const existing = await getMyBusiness(userId);
  if (!existing) return db().business.create({ data: { ownerId: userId, ...input } });
  // changing identity data invalidates a previous verification
  const identityChanged = existing.name !== input.name || existing.vatId !== (input.vatId ?? null) || existing.street !== (input.street ?? null);
  return db().business.update({
    where: { id: existing.id },
    data: { ...input, ...(identityChanged && existing.verificationStatus !== "UNVERIFIED" ? { verificationStatus: "UNVERIFIED", verifiedAt: null, verifiedById: null } : {}) },
  });
}

export async function requestBusinessVerification(userId: string, documentFileId: string) {
  const b = await getMyBusiness(userId);
  if (!b) throw notFound("Unternehmensprofil");
  const f = await db().uploadedFile.findFirst({ where: { id: documentFileId, ownerId: userId, purpose: "BUSINESS_DOC", deletedAt: null } });
  if (!f) throw notFound("Nachweis");
  await audit({ actorId: userId, action: "business.verification_requested", entityType: "Business", entityId: b.id, data: { fileId: f.id } });
  return db().business.update({ where: { id: b.id }, data: { verificationStatus: "PENDING" } });
}

/** Verified badge ONLY after a real admin review of the submitted document. */
export async function decideBusinessVerification(admin: SessionUser, businessId: string, approve: boolean) {
  const b = await db().business.findUnique({ where: { id: businessId } });
  if (!b) throw notFound("Unternehmen");
  if (b.verificationStatus !== "PENDING") throw conflict("Keine offene Prüfung.");
  const upd = await db().business.update({ where: { id: b.id }, data: approve ? { verificationStatus: "VERIFIED", verifiedAt: new Date(), verifiedById: admin.id } : { verificationStatus: "REJECTED" } });
  await audit({ actorId: admin.id, action: approve ? "business.verified" : "business.verification_rejected", entityType: "Business", entityId: b.id });
  await notify(b.ownerId, "SYSTEM", approve ? "Unternehmen verifiziert" : "Verifizierung abgelehnt", approve ? `${b.name} ist jetzt verifiziert.` : "Die eingereichten Unterlagen reichten nicht aus.", "/konto/unternehmen");
  return upd;
}

export function assertSelfOrAdmin(user: SessionUser, ownerId: string) {
  if (user.id !== ownerId && !user.isAdmin) throw forbidden();
}
