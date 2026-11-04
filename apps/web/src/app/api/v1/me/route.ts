import { deleteAccountSchema } from "@myminijob/core";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/session";
import { route } from "@/server/http";
import { deleteAccount } from "@/server/services/privacy";

export const GET = route({ auth: "optional" }, async ({ user }) => {
  if (!user) return { user: null };
  const { sessionId: _s, ...publicUser } = user;
  return { user: publicUser };
});

/** DSGVO Art. 17: Konto löschen (Anonymisierung, gesetzliche Aufbewahrung von Rechnungen bleibt). */
export const DELETE = route({ auth: "required", rateLimit: { name: "delete-account", limit: 5, windowSec: 3600 } }, async (ctx) => {
  const { password } = await ctx.body(deleteAccountSchema);
  await deleteAccount(ctx.user!.id, password);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
