import { z } from "zod";
import { route } from "@/server/http";
import { resolveDispute } from "@/server/services/mediation";
export const POST = route<{ id: string }>({ auth: "admin" }, async (ctx) => {
  const { refund, resolution } = await ctx.body(z.object({ refund: z.boolean(), resolution: z.string().trim().min(3).max(500) }));
  await resolveDispute(ctx.user!, ctx.params.id, refund, resolution);
  return { ok: true };
});
