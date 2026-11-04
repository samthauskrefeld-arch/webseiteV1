import { consentSchema } from "@myminijob/core";
import { db } from "@/server/db";
import { route } from "@/server/http";
export const POST = route({ auth: "optional" }, async (ctx) => {
  const { type, granted } = await ctx.body(consentSchema);
  if (ctx.user) await db().consent.create({ data: { userId: ctx.user.id, type, version: "2026-11", granted } });
  return { ok: true };
});
