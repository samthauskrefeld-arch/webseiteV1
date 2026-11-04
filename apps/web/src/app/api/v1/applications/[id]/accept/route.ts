import { acceptApplicationSchema } from "@myminijob/core";
import { route } from "@/server/http";
import { acceptApplication } from "@/server/services/mediation";

/**
 * Binding, fee-acknowledged offer. Body must contain feeAcknowledged=true and the fee notice version
 * the user saw. Header Idempotency-Key required.
 */
export const POST = route<{ id: string }>({ auth: "required", rateLimit: { name: "accept", limit: 60, windowSec: 3600 } }, async (ctx) => {
  const input = await ctx.body(acceptApplicationSchema);
  const { mediation, replayed } = await acceptApplication(ctx.user!, ctx.params.id, input, ctx.req.headers.get("idempotency-key") ?? "");
  return { mediationId: mediation.id, status: mediation.status, expiresAt: mediation.expiresAt, replayed };
});
