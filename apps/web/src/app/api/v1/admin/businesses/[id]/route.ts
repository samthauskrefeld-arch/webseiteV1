import { z } from "zod";
import { route } from "@/server/http";
import { decideBusinessVerification } from "@/server/services/community";
export const POST = route<{ id: string }>({ auth: "admin" }, async (ctx) => {
  const { approve } = await ctx.body(z.object({ approve: z.boolean() }));
  return { business: await decideBusinessVerification(ctx.user!, ctx.params.id, approve) };
});
