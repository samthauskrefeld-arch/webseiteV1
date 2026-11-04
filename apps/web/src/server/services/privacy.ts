import "server-only";
import { randomUUID } from "node:crypto";
import { storage } from "../adapters/storage";
import { audit } from "../audit";
import { hashPassword, verifyPassword } from "../auth/crypto";
import { db } from "../db";
import { ApiError } from "../errors";

/** DSGVO Art. 15/20: machine-readable export of all personal data we hold about the user. */
export async function exportMyData(userId: string) {
  const [user, profile, resume, listings, applications, messages, invoices, consents, notifications, files, reviews, business] = await Promise.all([
    db().user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, emailVerifiedAt: true, activeRole: true, createdAt: true, roles: { select: { type: true } } } }),
    db().profile.findUnique({ where: { userId } }),
    db().resume.findUnique({ where: { userId }, include: { qualifications: { include: { qualification: { select: { name: true, kind: true } } } } } }),
    db().listing.findMany({ where: { ownerId: userId }, include: { requirements: true } }),
    db().application.findMany({ where: { applicantId: userId }, include: { events: true, listing: { select: { title: true } } } }),
    db().message.findMany({ where: { senderId: userId }, select: { id: true, conversationId: true, body: true, createdAt: true } }),
    db().invoice.findMany({ where: { recipientUserId: userId } }),
    db().consent.findMany({ where: { userId } }),
    db().notification.findMany({ where: { userId } }),
    db().uploadedFile.findMany({ where: { ownerId: userId }, select: { id: true, originalName: true, mimeType: true, sizeBytes: true, purpose: true, createdAt: true, deletedAt: true } }),
    db().review.findMany({ where: { OR: [{ authorId: userId }, { subjectId: userId }] } }),
    db().business.findMany({ where: { ownerId: userId } }),
  ]);
  await audit({ actorId: userId, action: "privacy.export", entityType: "User", entityId: userId });
  return { exportedAt: new Date().toISOString(), format: "my-minijob-export-v1", user, profile, resume, listings, applications, messages, invoices, consents, notifications, files, reviews, business };
}

/**
 * DSGVO Art. 17 – account deletion. Personal data is erased/anonymised; invoices and the
 * fee events behind them are retained because of statutory retention duties (§ 147 AO, § 257 HGB),
 * Art. 17 Abs. 3 lit. b DSGVO. Messages remain for the other participant, shown as "Gelöschtes Konto". LEGAL_REVIEW
 */
export async function deleteAccount(userId: string, password: string) {
  const user = await db().user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(user.passwordHash, password))) throw new ApiError("UNAUTHENTICATED", "Passwort ist falsch.");
  const pending = await db().mediationEvent.count({ where: { OR: [{ posterId: userId }, { applicantId: userId }], status: "PENDING_APPLICANT" } });
  if (pending) throw new ApiError("CONFLICT", "Bitte beantworte oder nimm offene Zusagen zuerst zurück.");
  const files = await db().uploadedFile.findMany({ where: { ownerId: userId, deletedAt: null } });
  for (const f of files) await storage().delete(f.storageKey).catch(() => {});
  const anon = `geloescht-${randomUUID().slice(0, 8)}`;
  await db().$transaction(async (tx) => {
    await tx.application.updateMany({ where: { applicantId: userId, status: { in: ["submitted", "viewed", "shortlisted"] } }, data: { status: "withdrawn" } });
    await tx.listing.updateMany({ where: { ownerId: userId, status: { in: ["PUBLISHED", "PAUSED"] } }, data: { status: "CLOSED", closedAt: new Date() } });
    await tx.application.updateMany({ where: { applicantId: userId }, data: { resumeSnapshot: { deleted: true }, message: "" } });
    await tx.uploadedFile.updateMany({ where: { ownerId: userId }, data: { deletedAt: new Date(), originalName: "gelöscht" } });
    await tx.profile.update({ where: { userId }, data: { username: anon, city: null, postalCode: null, lat: null, lng: null, about: null, skills: [], languages: [], availability: null, desiredHourlyCents: null } });
    await tx.resume.update({ where: { userId }, data: { headline: "", summary: "", experience: [], education: [] } });
    await tx.resumeQualification.deleteMany({ where: { resume: { userId } } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.pushSubscription.deleteMany({ where: { userId } });
    await tx.notificationPreference.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.verificationToken.deleteMany({ where: { userId } });
    await tx.billingAddress.deleteMany({ where: { userId } });
    await tx.user.update({ where: { id: userId }, data: { email: `${anon}@deleted.invalid`, passwordHash: await hashPassword(randomUUID()), status: "DELETED", deletedAt: new Date() } });
  });
  await audit({ actorId: null, action: "privacy.account_deleted", entityType: "User", entityId: userId });
}
