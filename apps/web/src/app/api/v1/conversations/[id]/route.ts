import { z } from "zod";
import { route } from "@/server/http";
import { setReadReceipts } from "@/server/services/chat";
export const PATCH = route<{ id: string }>({ auth: "required" }, async (ctx) => {
  const { shareReadReceipts } = await ctx.body(z.object({ shareReadReceipts: z.boolean() }));
  await setReadReceipts(ctx.user!.id, ctx.params.id, shareReadReceipts);
  return { ok: true };
});
