import { z } from "zod";
import { route } from "@/server/http";
import { listNotifications, markNotificationsRead } from "@/server/services/notifications";
export const GET = route({ auth: "required" }, async ({ user }) => listNotifications(user!.id));
export const POST = route({ auth: "required" }, async (ctx) => {
  const { ids } = await ctx.body(z.object({ ids: z.array(z.string().uuid()).max(100).optional() }));
  await markNotificationsRead(ctx.user!.id, ids);
  return { ok: true };
});
