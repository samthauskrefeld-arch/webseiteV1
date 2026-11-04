import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getSessionUser, SESSION_COOKIE, type SessionUser } from "./auth/session";
import { env } from "./env";
import { ApiError } from "./errors";
import { rateLimit } from "./ratelimit";
import { logError } from "./log";

export interface Ctx<P extends Record<string, string> = Record<string, string>> {
  req: NextRequest;
  params: P;
  user: SessionUser | null;
  ip: string;
  /** Stable key for rate limiting: user id or IP */
  clientKey: string;
  body<T>(schema: ZodType<T>): Promise<T>;
  query<T>(schema: ZodType<T>): T;
}

interface Options {
  auth?: "none" | "optional" | "required" | "admin";
  /** e.g. { name: "login", limit: 10, windowSec: 600 } */
  rateLimit?: { name: string; limit: number; windowSec: number };
}

type Handler<P extends Record<string, string>> = (ctx: Ctx<P> & { user: SessionUser | null }) => Promise<unknown>;

export const CSRF_HEADER = "x-mmj-csrf";

function clientIp(req: NextRequest) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim().slice(0, 64);
}

/**
 * CSRF defence for cookie-authenticated mutations:
 *  1. custom header (cannot be set cross-site without a CORS preflight, which we never allow), and
 *  2. Origin must match APP_URL when the browser sends it.
 * Combined with SameSite=Lax cookies.
 */
function checkCsrf(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  if (req.headers.get(CSRF_HEADER) !== "1") throw new ApiError("FORBIDDEN", "CSRF-Prüfung fehlgeschlagen");
  const origin = req.headers.get("origin");
  if (origin) {
    const allowed = new Set([new URL(env().APP_URL).origin, `${req.nextUrl.protocol}//${req.headers.get("host")}`]);
    if (!allowed.has(origin)) throw new ApiError("FORBIDDEN", "Ungültige Herkunft der Anfrage");
  }
}

export function route<P extends Record<string, string> = Record<string, string>>(opts: Options, handler: Handler<P>) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      checkCsrf(req);
      const params = ((await context?.params) ?? {}) as P;
      const user = opts.auth === "none" ? null : await getSessionUser(req.cookies.get(SESSION_COOKIE)?.value);
      if ((opts.auth === "required" || opts.auth === "admin") && !user) throw new ApiError("UNAUTHENTICATED", "Bitte melde dich an.");
      if (opts.auth === "admin" && !user?.isAdmin) throw new ApiError("FORBIDDEN", "Nur für Administration");
      const ip = clientIp(req);
      const clientKey = user ? `u:${user.id}` : `ip:${ip}`;
      if (opts.rateLimit) await rateLimit(`${opts.rateLimit.name}:${clientKey}`, opts.rateLimit.limit, opts.rateLimit.windowSec);
      const ctx: Ctx<P> = {
        req,
        params,
        user,
        ip,
        clientKey,
        async body(schema) {
          let raw: unknown;
          try {
            raw = await req.json();
          } catch {
            throw new ApiError("BAD_REQUEST", "Ungültiges JSON");
          }
          return schema.parse(raw);
        },
        query(schema) {
          return schema.parse(Object.fromEntries(req.nextUrl.searchParams));
        },
      };
      const result = await handler(ctx);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, fields: e.fields } }, { status: e.status });
  }
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of e.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
    return NextResponse.json({ error: { code: "VALIDATION", message: "Bitte Eingaben prüfen", fields } }, { status: 422 });
  }
  const pgCode = (e as { code?: string })?.code;
  if (pgCode === "P2002") {
    return NextResponse.json({ error: { code: "CONFLICT", message: "Eintrag existiert bereits" } }, { status: 409 });
  }
  logError("unhandled_api_error", e);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Unerwarteter Fehler. Bitte später erneut versuchen." } }, { status: 500 });
}
