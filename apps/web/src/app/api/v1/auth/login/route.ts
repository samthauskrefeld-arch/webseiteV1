import { NextResponse } from "next/server";
import { loginSchema } from "@myminijob/core";
import { cookieOptions, SESSION_COOKIE } from "@/server/auth/session";
import { route } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { login } from "@/server/services/auth";

export const POST = route({ auth: "none", rateLimit: { name: "login-ip", limit: 30, windowSec: 600 } }, async (ctx) => {
  const { email, password } = await ctx.body(loginSchema);
  await rateLimit(`login-account:${email}`, 10, 900);
  const { user, session } = await login(email, password, ctx.req.headers.get("user-agent"));
  const res = NextResponse.json({ user: { id: user.id, emailVerified: !!user.emailVerifiedAt, activeRole: user.activeRole } });
  res.cookies.set(SESSION_COOKIE, session.token, cookieOptions(session.expiresAt));
  return res;
});
