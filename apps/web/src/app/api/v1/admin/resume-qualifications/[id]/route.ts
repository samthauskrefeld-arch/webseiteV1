import { z } from "zod";
import { route } from "@/server/http";
import { verifyResumeQualification } from "@/server/services/profile";
export const POST = route<{ id: string }>({ auth: "admin" }, async (ctx) => {
  const { approve } = await ctx.body(z.object({ approve: z.boolean() }));
  await verifyResumeQualification(ctx.user!.id, ctx.params.id, approve);
  return { ok: true };
});
