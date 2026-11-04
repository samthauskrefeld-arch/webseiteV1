import { z } from "zod";
import { db } from "@/server/db";
import { ApiError } from "@/server/errors";
import { route } from "@/server/http";
import { pushEnabled } from "@/server/adapters/push";

const sub = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });
export const POST = route({ auth: "required" }, async (ctx) => {
  if (!pushEnabled()) throw new ApiError("UNAVAILABLE", "Push-Benachrichtigungen sind nicht konfiguriert.");
  const s = await ctx.body(sub);
  await db().pushSubscription.upsert({ where: { endpoint: s.endpoint }, create: { userId: ctx.user!.id, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth }, update: { userId: ctx.user!.id, p256dh: s.keys.p256dh, auth: s.keys.auth } });
  return { ok: true };
});
export const DELETE = route({ auth: "required" }, async (ctx) => {
  const { endpoint } = await ctx.body(z.object({ endpoint: z.string().max(1000) }));
  await db().pushSubscription.deleteMany({ where: { userId: ctx.user!.id, endpoint } });
  return { ok: true };
});
