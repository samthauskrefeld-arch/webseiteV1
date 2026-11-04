import { z } from "zod";
import { route } from "@/server/http";
import { requestBusinessVerification } from "@/server/services/community";
export const POST = route({ auth: "required" }, async (ctx) => {
  const { documentFileId } = await ctx.body(z.object({ documentFileId: z.string().uuid() }));
  return { business: await requestBusinessVerification(ctx.user!.id, documentFileId) };
});
