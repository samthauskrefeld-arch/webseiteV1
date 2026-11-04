import { NextResponse } from "next/server";
import { revokeSession, SESSION_COOKIE } from "@/server/auth/session";
import { route } from "@/server/http";

export const POST = route({ auth: "optional" }, async (ctx) => {
  const token = ctx.req.cookies.get(SESSION_COOKIE)?.value;
  if (token) await revokeSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
