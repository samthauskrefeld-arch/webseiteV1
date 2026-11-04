import "server-only";
import {
  CANCELLATION_WINDOW_DAYS,
  FEE_NOTICE_VERSION,
  MEDIATION_FEE_CENTS,
  OFFER_CONFIRMATION_DAYS,
  SLOT_OCCUPYING,
} from "@myminijob/core";
import type { SessionUser } from "../auth/session";
import { requireVerified } from "../auth/session";
import { audit } from "../audit";
import { db } from "../db";
import { ApiError, conflict, forbidden, notFound } from "../errors";
import { issueCancellationInvoice, issueFeeInvoice } from "./invoices";
import { notify } from "./notifications";
import { refundInvoicePayments } from "./payments";

/**
 * Step 1 – poster gives a BINDING, fee-acknowledged offer ("Zahlungspflichtig zusagen").
 * Creates exactly one MediationEvent (UNIQUE applicationId + idempotency key) in status
 * PENDING_APPLICANT. No fee yet. Positions are protected with a row lock on the listing.
 */
export async function acceptApplication(user: SessionUser, appId: string, input: { feeAcknowledged: true; feeNoticeVersion: string }, idempotencyKey: string) {
  requireVerified(user);
  if (!/^[\w-]{16,100}$/.test(idempotencyKey)) throw new ApiError("BAD_REQUEST", "Idempotency-Key fehlt oder ist ungültig");
  if (input.feeNoticeVersion !== FEE_NOTICE_VERSION) throw conflict("Der Gebührenhinweis wurde aktualisiert. Bitte Seite neu laden und erneut bestätigen.");

  const replay = await db().mediationEvent.findUnique({ where: { idempotencyKey } });
  if (replay) {
    if (replay.applicationId !== appId || replay.posterId !== user.id) throw conflict("Idempotency-Key wurde bereits verwendet");
    return { mediation: replay, replayed: true };
  }

  const result = await db().$transaction(async (tx) => {
    const app = await tx.application.findUnique({ where: { id: appId }, include: { listing: true } });
    if (!app) throw notFound("Bewerbung");
    if (app.listing.ownerId !== user.id) throw forbidden();
    // serialise all offers for this listing
    await tx.$queryRaw`SELECT "id" FROM "Listing" WHERE "id" = ${app.listingId}::uuid FOR UPDATE`;
    const existing = await tx.mediationEvent.findUnique({ where: { applicationId: appId } });
    // concurrent retry with the same key waited for the lock → idempotent replay
    if (existing && existing.idempotencyKey === idempotencyKey) return { mediation: existing, app, replayed: true };
    if (existing) throw conflict("Für diese Bewerbung wurde bereits eine Zusage erteilt.");
    if (!["submitted", "viewed", "shortlisted"].includes(app.status)) throw conflict("Bewerbung kann im aktuellen Status nicht angenommen werden.");
    if (!["PUBLISHED", "PAUSED"].includes(app.listing.status)) throw conflict("Das Inserat ist nicht aktiv.");
    const occupied = await tx.mediationEvent.count({ where: { listingId: app.listingId, status: { in: SLOT_OCCUPYING } } });
    if (occupied >= app.listing.positions) throw conflict(`Alle ${app.listing.positions} Plätze sind bereits vergeben.`);

    const mediation = await tx.mediationEvent.create({
      data: {
        applicationId: app.id,
        listingId: app.listingId,
        posterId: user.id,
        applicantId: app.applicantId,
        feeCents: MEDIATION_FEE_CENTS,
        idempotencyKey,
        feeNoticeVersion: input.feeNoticeVersion,
        feeAcknowledgedAt: new Date(),
        expiresAt: new Date(Date.now() + OFFER_CONFIRMATION_DAYS * 86400_000),
      },
    });
    const upd = await tx.application.updateMany({ where: { id: app.id, status: app.status }, data: { status: "accepted" } });
    if (upd.count !== 1) throw conflict("Status hat sich geändert, bitte neu laden.");
    await tx.applicationEvent.create({ data: { applicationId: app.id, actorId: user.id, fromStatus: app.status, toStatus: "accepted", note: `Gebührenhinweis ${input.feeNoticeVersion} bestätigt` } });
    await audit({ actorId: user.id, action: "mediation.offer", entityType: "MediationEvent", entityId: mediation.id, data: { feeCents: MEDIATION_FEE_CENTS, feeNoticeVersion: input.feeNoticeVersion } }, tx);
    return { mediation, app, replayed: false };
  });
  if (result.replayed) return { mediation: result.mediation, replayed: true };
  await notify(result.app.applicantId, "OFFER_RECEIVED", "Du hast eine Zusage!", `Für „${result.app.listing.title}“ wurde dir zugesagt. Bitte bestätige innerhalb von ${OFFER_CONFIRMATION_DAYS} Tagen.`, `/konto/angebote`);
  return { mediation: result.mediation, replayed: false };
}

/**
 * Step 2 – applicant accepts → placement happened → the ONE fee event (+ invoice) is created.
 * Row lock on the MediationEvent makes concurrent/double confirmations safe.
 */
export async function respondToOffer(user: SessionUser, mediationId: string, accept: boolean) {
  const result = await db().$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "MediationEvent" WHERE "id" = ${mediationId}::uuid FOR UPDATE`;
    if (!locked.length) throw notFound("Zusage");
    const m = await tx.mediationEvent.findUniqueOrThrow({ where: { id: mediationId }, include: { listing: { select: { title: true } } } });
    if (m.applicantId !== user.id) throw notFound("Zusage");
    if (m.status === "CONFIRMED" && accept) return { mediation: m, replayed: true, invoiceId: null as string | null };
    if (m.status !== "PENDING_APPLICANT") throw conflict("Diese Zusage ist nicht mehr offen.");
    if (m.expiresAt < new Date()) throw conflict("Diese Zusage ist abgelaufen.");
    if (accept) {
      const confirmed = await tx.mediationEvent.update({ where: { id: m.id }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
      const invoice = await issueFeeInvoice(tx, confirmed);
      await tx.applicationEvent.create({ data: { applicationId: m.applicationId, actorId: user.id, fromStatus: "accepted", toStatus: "accepted", note: "Zusage angenommen – Vermittlung bestätigt" } });
      await audit({ actorId: user.id, action: "mediation.confirmed", entityType: "MediationEvent", entityId: m.id, data: { invoiceId: invoice.id, feeCents: m.feeCents } }, tx);
      return { mediation: { ...confirmed, listing: m.listing }, replayed: false, invoiceId: invoice.id as string | null };
    }
    const declined = await tx.mediationEvent.update({ where: { id: m.id }, data: { status: "DECLINED", closedAt: new Date() } });
    await tx.application.update({ where: { id: m.applicationId }, data: { status: "withdrawn" } });
    await tx.applicationEvent.create({ data: { applicationId: m.applicationId, actorId: user.id, fromStatus: "accepted", toStatus: "withdrawn", note: "Zusage abgelehnt – keine Gebühr" } });
    await audit({ actorId: user.id, action: "mediation.declined", entityType: "MediationEvent", entityId: m.id }, tx);
    return { mediation: { ...declined, listing: m.listing }, replayed: false, invoiceId: null };
  });
  if (!result.replayed) {
    const m = result.mediation;
    await notify(
      m.posterId,
      "OFFER_RESPONSE",
      accept ? "Zusage angenommen" : "Zusage abgelehnt",
      accept
        ? `${user.username} hat deine Zusage für „${m.listing.title}“ angenommen. Die Vermittlungsgebühr von 1,00 € wurde berechnet.`
        : `${user.username} hat deine Zusage für „${m.listing.title}“ abgelehnt. Es fällt keine Gebühr an.`,
      accept && result.invoiceId ? `/konto/rechnungen/${result.invoiceId}` : `/konto/inserate/${m.listingId}`,
    );
  }
  return result;
}

/** Poster withdraws a pending offer before the applicant accepted – no fee arises. */
export async function withdrawOffer(user: SessionUser, mediationId: string) {
  const m = await db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "MediationEvent" WHERE "id" = ${mediationId}::uuid FOR UPDATE`;
    const m = await tx.mediationEvent.findUnique({ where: { id: mediationId }, include: { listing: { select: { title: true } } } });
    if (!m || m.posterId !== user.id) throw notFound("Zusage");
    if (m.status !== "PENDING_APPLICANT") throw conflict("Nur offene Zusagen können zurückgenommen werden.");
    const upd = await tx.mediationEvent.update({ where: { id: m.id }, data: { status: "WITHDRAWN_BY_POSTER", closedAt: new Date() } });
    await tx.application.update({ where: { id: m.applicationId }, data: { status: "rejected" } });
    await tx.applicationEvent.create({ data: { applicationId: m.applicationId, actorId: user.id, fromStatus: "accepted", toStatus: "rejected", note: "Zusage zurückgenommen – keine Gebühr" } });
    await audit({ actorId: user.id, action: "mediation.withdrawn", entityType: "MediationEvent", entityId: m.id }, tx);
    return { ...upd, listing: m.listing };
  });
  await notify(m.applicantId, "APPLICATION_STATUS", "Zusage zurückgenommen", `Die Zusage für „${m.listing.title}“ wurde zurückgenommen.`, `/konto/bewerbungen`);
  return m;
}

/** Expires offers not answered in time (no fee). Called lazily and by the maintenance script. */
export async function expireStaleOffers() {
  const stale = await db().mediationEvent.findMany({ where: { status: "PENDING_APPLICANT", expiresAt: { lt: new Date() } }, select: { id: true, applicationId: true, posterId: true } });
  for (const s of stale) {
    const changed = await db().$transaction(async (tx) => {
      const r = await tx.mediationEvent.updateMany({ where: { id: s.id, status: "PENDING_APPLICANT" }, data: { status: "EXPIRED", closedAt: new Date() } });
      if (!r.count) return false;
      await tx.application.update({ where: { id: s.applicationId }, data: { status: "rejected" } });
      await tx.applicationEvent.create({ data: { applicationId: s.applicationId, fromStatus: "accepted", toStatus: "rejected", note: "Zusage abgelaufen – keine Gebühr" } });
      return true;
    });
    if (changed) await notify(s.posterId, "OFFER_RESPONSE", "Zusage abgelaufen", "Eine Zusage wurde nicht rechtzeitig bestätigt. Es fällt keine Gebühr an.", "/konto/inserate");
  }
  return stale.length;
}

/** Both sides mark the job as done → COMPLETED → reviews unlocked. */
export async function markCompleted(user: SessionUser, mediationId: string) {
  const m = await db().mediationEvent.findUnique({ where: { id: mediationId } });
  if (!m || (m.posterId !== user.id && m.applicantId !== user.id)) throw notFound("Vermittlung");
  if (m.status !== "CONFIRMED") throw conflict("Nur bestätigte Vermittlungen können abgeschlossen werden.");
  const field = m.posterId === user.id ? "posterCompletedAt" : "applicantCompletedAt";
  const updated = await db().mediationEvent.update({ where: { id: m.id }, data: { [field]: m[field] ?? new Date() } });
  if (updated.posterCompletedAt && updated.applicantCompletedAt) {
    const done = await db().mediationEvent.update({ where: { id: m.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    for (const uid of [m.posterId, m.applicantId]) await notify(uid, "REVIEW", "Auftrag abgeschlossen", "Ihr könnt euch jetzt gegenseitig bewerten.", `/konto/angebote`);
    return done;
  }
  const other = m.posterId === user.id ? m.applicantId : m.posterId;
  await notify(other, "SYSTEM", "Abschluss bestätigen", `${user.username} hat den Auftrag als erledigt markiert. Bitte bestätige ebenfalls.`, m.posterId === user.id ? "/konto/angebote" : `/konto/inserate/${m.listingId}`);
  return updated;
}

/** Opens a dispute (e.g. no-show) within the cancellation window. Resolution by admin. */
export async function openDispute(user: SessionUser, mediationId: string, reason: string) {
  const m = await db().mediationEvent.findUnique({ where: { id: mediationId } });
  if (!m || (m.posterId !== user.id && m.applicantId !== user.id)) throw notFound("Vermittlung");
  if (m.status !== "CONFIRMED") throw conflict("Streitfälle sind nur für bestätigte Vermittlungen möglich.");
  if (m.confirmedAt && Date.now() - m.confirmedAt.getTime() > CANCELLATION_WINDOW_DAYS * 86400_000) throw conflict(`Storno ist nur innerhalb von ${CANCELLATION_WINDOW_DAYS} Tagen nach Bestätigung möglich.`);
  const open = await db().dispute.findFirst({ where: { mediationEventId: m.id, status: "OPEN" } });
  if (open) throw conflict("Es gibt bereits einen offenen Streitfall.");
  const d = await db().dispute.create({ data: { mediationEventId: m.id, openedById: user.id, reason } });
  await audit({ actorId: user.id, action: "dispute.open", entityType: "Dispute", entityId: d.id });
  return d;
}

/** Admin decision. Refund → mediation CANCELLED, cancellation invoice, payment refunded (test adapter). */
export async function resolveDispute(admin: SessionUser, disputeId: string, refund: boolean, resolution: string) {
  const d = await db().dispute.findUnique({ where: { id: disputeId }, include: { mediationEvent: true } });
  if (!d) throw notFound("Streitfall");
  if (d.status !== "OPEN") throw conflict("Streitfall ist bereits entschieden.");
  await db().$transaction(async (tx) => {
    await tx.dispute.update({ where: { id: d.id }, data: { status: refund ? "RESOLVED_REFUND" : "RESOLVED_REJECTED", resolution, resolvedById: admin.id, resolvedAt: new Date() } });
    if (refund) {
      await tx.mediationEvent.update({ where: { id: d.mediationEventId }, data: { status: "CANCELLED", closedAt: new Date(), cancelReason: resolution.slice(0, 500) } });
      await issueCancellationInvoice(tx, d.mediationEventId);
      await refundInvoicePayments(tx, d.mediationEventId);
    }
    await audit({ actorId: admin.id, action: refund ? "dispute.refund" : "dispute.reject", entityType: "Dispute", entityId: d.id }, tx);
  });
  for (const uid of [d.mediationEvent.posterId, d.mediationEvent.applicantId]) {
    await notify(uid, "SYSTEM", "Streitfall entschieden", refund ? "Die Vermittlung wurde storniert, die Gebühr wird erstattet." : "Der Streitfall wurde geprüft; die Vermittlung bleibt bestehen.", "/konto");
  }
}

export async function listMyOffers(userId: string) {
  await expireStaleOffers();
  return db().mediationEvent.findMany({
    where: { applicantId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      listing: { select: { id: true, title: true, city: true, remote: true, hourlyWageCents: true, startDate: true, owner: { select: { profile: { select: { username: true } } } }, business: { select: { name: true } } } },
      application: { select: { id: true, conversation: { select: { id: true } } } },
      reviews: { where: { authorId: userId }, select: { id: true } },
      disputes: { where: { status: "OPEN" }, select: { id: true } },
    },
  });
}
