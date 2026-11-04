import { NextResponse } from "next/server";
import { registerSchema } from "@myminijob/core";
import { cookieOptions, SESSION_COOKIE } from "@/server/auth/session";
import { route } from "@/server/http";
import { register } from "@/server/services/auth";

export const POST = route({ auth: "none", rateLimit: { name: "register", limit: 5, windowSec: 3600 } }, async (ctx) => {
  const input = await ctx.body(registerSchema);
  const { user, session } = await register(input, ctx.req.headers.get("user-agent"));
  const res = NextResponse.json({ user: { id: user.id, email: user.email, emailVerified: false } }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, session.token, cookieOptions(session.expiresAt));
  return res;
});
