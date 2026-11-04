import { z } from "zod";
import { route } from "@/server/http";
import { respondToOffer } from "@/server/services/mediation";
export const POST = route<{ id: string }>({ auth: "required" }, async (ctx) => {
  const { accept } = await ctx.body(z.object({ accept: z.boolean() }));
  const r = await respondToOffer(ctx.user!, ctx.params.id, accept);
  return { status: r.mediation.status, invoiceId: r.invoiceId, replayed: r.replayed };
});
