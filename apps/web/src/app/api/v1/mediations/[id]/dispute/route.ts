import { disputeSchema } from "@myminijob/core";
import { route } from "@/server/http";
import { openDispute } from "@/server/services/mediation";
export const POST = route<{ id: string }>({ auth: "required" }, async (ctx) => {
  const { reason } = await ctx.body(disputeSchema);
  return openDispute(ctx.user!, ctx.params.id, reason);
});
