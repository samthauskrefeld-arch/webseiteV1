import "server-only";
import type { z } from "zod";
import { registerSchema, type RoleType } from "@myminijob/core";
import { appLink, sendMail } from "../adapters/mail";
import { audit } from "../audit";
import { hashPassword, hashToken, randomToken, verifyPassword } from "../auth/crypto";
import { createSession, revokeAllSessions } from "../auth/session";
import { db } from "../db";
import { ApiError, conflict } from "../errors";

export const TERMS_VERSION = "entwurf-2026-11";
export const PRIVACY_VERSION = "entwurf-2026-11";

async function issueToken(userId: string, type: "EMAIL_VERIFY" | "PASSWORD_RESET", ttlMinutes: number) {
  const token = randomToken(32);
  await db().verificationToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  await db().verificationToken.create({ data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) } });
  return token;
}

export async function sendVerificationMail(userId: string, email: string) {
  const token = await issueToken(userId, "EMAIL_VERIFY", 60 * 24);
  await sendMail(
    email,
    "Bitte bestätige deine E-Mail-Adresse",
    `Willkommen bei My Minijob!\n\nBitte bestätige deine E-Mail-Adresse über diesen Link (24 Stunden gültig):\n${appLink(`/email-bestaetigen?token=${token}`)}\n\nFalls du dich nicht registriert hast, kannst du diese E-Mail ignorieren.`,
  );
}

export async function register(input: z.infer<typeof registerSchema>, userAgent?: string | null) {
  const existing = await db().user.findUnique({ where: { email: input.email } });
  const usernameTaken = await db().profile.findUnique({ where: { username: input.username } });
  if (usernameTaken) throw new ApiError("CONFLICT", "Benutzername ist vergeben", { username: "Benutzername ist vergeben" });
  if (existing) {
    // Do not reveal registered addresses: tell the owner by mail instead.
    await sendMail(existing.email, "Registrierungsversuch", `Jemand hat versucht, mit deiner E-Mail-Adresse ein neues Konto anzulegen. Du hast bereits ein Konto. Passwort vergessen? ${appLink("/passwort-vergessen")}`);
    throw conflict("Registrierung nicht möglich. Bitte prüfe dein Postfach oder melde dich an.");
  }
  const passwordHash = await hashPassword(input.password);
  const roles: RoleType[] = ["APPLICANT", "PRIVATE_POSTER", "BUSINESS_POSTER"];
  const user = await db().user.create({
    data: {
      email: input.email,
      passwordHash,
      activeRole: input.initialRole,
      roles: { create: roles.map((type) => ({ type })) },
      profile: { create: { username: input.username, visibility: {} } },
      resume: { create: {} },
      consents: {
        create: [
          { type: "TERMS", version: TERMS_VERSION, granted: true },
          { type: "PRIVACY", version: PRIVACY_VERSION, granted: true },
        ],
      },
    },
  });
  await audit({ actorId: user.id, action: "user.register", entityType: "User", entityId: user.id });
  await sendVerificationMail(user.id, user.email);
  const session = await createSession(user.id, userAgent);
  return { user, session };
}

export async function login(email: string, password: string, userAgent?: string | null) {
  const user = await db().user.findUnique({ where: { email } });
  const ok = await verifyPassword(user?.passwordHash ?? null, password);
  if (!user || !ok || user.status === "DELETED") {
    if (user) await audit({ actorId: user.id, action: "auth.login_failed", entityType: "User", entityId: user.id });
    throw new ApiError("UNAUTHENTICATED", "E-Mail oder Passwort ist falsch.");
  }
  if (user.status === "SUSPENDED") throw new ApiError("FORBIDDEN", "Dieses Konto ist gesperrt. Bitte kontaktiere den Support.");
  const session = await createSession(user.id, userAgent);
  await audit({ actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id });
  return { user, session };
}

export async function verifyEmail(token: string) {
  const t = await db().verificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!t || t.type !== "EMAIL_VERIFY" || t.usedAt || t.expiresAt < new Date()) throw new ApiError("BAD_REQUEST", "Link ist ungültig oder abgelaufen.");
  await db().$transaction([
    db().verificationToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
    db().user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
  await audit({ actorId: t.userId, action: "user.email_verified", entityType: "User", entityId: t.userId });
}

export async function requestPasswordReset(email: string) {
  const user = await db().user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE") return; // same response either way
  const token = await issueToken(user.id, "PASSWORD_RESET", 60);
  await sendMail(user.email, "Passwort zurücksetzen", `Über diesen Link kannst du ein neues Passwort festlegen (60 Minuten gültig):\n${appLink(`/passwort-zuruecksetzen?token=${token}`)}\n\nWenn du das nicht angefordert hast, ignoriere diese E-Mail. Dein Passwort bleibt unverändert.`);
}

export async function resetPassword(token: string, password: string) {
  const t = await db().verificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!t || t.type !== "PASSWORD_RESET" || t.usedAt || t.expiresAt < new Date()) throw new ApiError("BAD_REQUEST", "Link ist ungültig oder abgelaufen.");
  const passwordHash = await hashPassword(password);
  await db().$transaction([
    db().verificationToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
    db().user.update({ where: { id: t.userId }, data: { passwordHash, emailVerifiedAt: new Date() } }),
  ]);
  await revokeAllSessions(t.userId);
  await audit({ actorId: t.userId, action: "auth.password_reset", entityType: "User", entityId: t.userId });
}

export async function switchRole(userId: string, role: RoleType) {
  const has = await db().role.findUnique({ where: { userId_type: { userId, type: role } } });
  if (!has) throw new ApiError("FORBIDDEN", "Diese Rolle ist für dein Konto nicht freigeschaltet.");
  await db().user.update({ where: { id: userId }, data: { activeRole: role } });
  return { activeRole: role };
}
