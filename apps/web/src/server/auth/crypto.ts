import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { env } from "../env";

/** Argon2id with library defaults (m=19 MiB, t=2, p=1 – OWASP baseline). */
export const hashPassword = (password: string) => hash(password);

let dummyHash: Promise<string> | null = null;

export async function verifyPassword(passwordHash: string | null, password: string): Promise<boolean> {
  try {
    // Always run a verification so response time does not reveal whether the account exists.
    dummyHash ??= hash("timing-equaliser-dummy-password");
    const ok = await verify(passwordHash ?? (await dummyHash), password);
    return passwordHash ? ok : false;
  } catch {
    return false;
  }
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Tokens are stored only as keyed hashes so a DB leak does not expose usable tokens. */
export const hashToken = (token: string) => createHmac("sha256", env().SESSION_SECRET).update(token).digest("hex");

export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
