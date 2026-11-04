import { z } from "zod";
import { route } from "@/server/http";
import { resolveReport } from "@/server/services/community";
export const POST = route<{ id: string }>({ auth: "admin" }, async (ctx) => {
  const { action, resolution } = await ctx.body(z.object({ action: z.enum(["dismiss", "hide", "suspend_user"]), resolution: z.string().trim().min(3).max(500) }));
  await resolveReport(ctx.user!, ctx.params.id, action, resolution);
  return { ok: true };
});
