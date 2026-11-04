import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { getSessionUser, type SessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { register } from "@/server/services/auth";
import type { ListingInput } from "@myminijob/core";

let n = 0;
export async function makeUser(opts: { verified?: boolean; prefix?: string } = {}): Promise<SessionUser & { token: string; password: string }> {
  n++;
  const tag = `${opts.prefix ?? "u"}${Date.now().toString(36)}${n}`;
  const password = "Sicheres-Passwort-1";
  const { user, session } = await register({ email: `${tag}@test.invalid`, password, username: tag.slice(0, 30), acceptTerms: true, initialRole: "APPLICANT" });
  if (opts.verified !== false) await db().user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  const su = await getSessionUser(session.token);
  return { ...su!, token: session.token, password };
}

export async function makeAdmin() {
  const u = await makeUser({ prefix: "adm" });
  await db().role.create({ data: { userId: u.id, type: "ADMIN" } });
  return { ...(await getSessionUser(u.token))!, token: u.token };
}

export const key = () => randomUUID();

export function listingInput(over: Partial<ListingInput> = {}): ListingInput {
  return {
    posterType: "PRIVATE",
    title: "Rasen mähen und Hecke schneiden",
    description: "Wir suchen Unterstützung im Garten: Rasen mähen, Hecke schneiden, Laub entfernen.",
    category: "GARTEN",
    employmentType: "EINMALIG",
    remote: false,
    city: "Krefeld",
    postalCode: null,
    hoursTotal: 4,
    hoursPerWeek: null,
    positions: 1,
    hourlyWageCents: 1500,
    paymentMethod: "BANK_TRANSFER",
    weekend: true,
    evening: false,
    requirements: [],
    ...over,
  } as ListingInput;
}

/** Builds a NextRequest for invoking route handlers directly (HTTP layer tests). */
export function req(method: string, path: string, opts: { body?: unknown; token?: string; csrf?: boolean; origin?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", host: "localhost:3000", ...(opts.headers ?? {}) };
  if (opts.csrf !== false && method !== "GET") headers["x-mmj-csrf"] = "1";
  if (opts.origin) headers.origin = opts.origin;
  if (opts.token) headers.cookie = `mmj_session=${opts.token}`;
  return new NextRequest(new URL(path, "http://localhost:3000"), { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
}
export const ctx = <P extends Record<string, string>>(params: P = {} as P) => ({ params: Promise.resolve(params) });
