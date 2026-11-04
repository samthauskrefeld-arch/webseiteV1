import "server-only";
import type { RoleType } from "@myminijob/core";
import { db } from "../db";
import { ApiError } from "../errors";
import { hashToken, randomToken } from "./crypto";

export const SESSION_COOKIE = "mmj_session";
export const SESSION_TTL_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  emailVerified: boolean;
  activeRole: RoleType;
  roles: RoleType[];
  isAdmin: boolean;
  sessionId: string;
}

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
  const session = await db().session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt, userAgent: userAgent?.slice(0, 200) ?? null },
  });
  return { token, expiresAt, sessionId: session.id };
}

export async function getSessionUser(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  const session = await db().session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { roles: true, profile: { select: { username: true } } } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
  // sliding expiry, written at most hourly
  if (Date.now() - session.lastSeenAt.getTime() > 3600_000) {
    await db().session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 86400_000) },
    });
  }
  const roles = session.user.roles.map((r) => r.type as RoleType);
  return {
    id: session.user.id,
    email: session.user.email,
    username: session.user.profile?.username ?? "",
    emailVerified: !!session.user.emailVerifiedAt,
    activeRole: session.user.activeRole as RoleType,
    roles,
    isAdmin: roles.includes("ADMIN"),
    sessionId: session.id,
  };
}

export async function revokeSession(token: string) {
  await db().session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await db().session.deleteMany({ where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });
}

export function requireVerified(user: SessionUser) {
  if (!user.emailVerified) throw new ApiError("EMAIL_NOT_VERIFIED", "Bitte bestätige zuerst deine E-Mail-Adresse.");
}

export function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
