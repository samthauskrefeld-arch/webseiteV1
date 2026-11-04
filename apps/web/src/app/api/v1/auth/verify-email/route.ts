import { tokenSchema } from "@myminijob/core";
import { route } from "@/server/http";
import { verifyEmail } from "@/server/services/auth";

export const POST = route({ auth: "none", rateLimit: { name: "verify", limit: 20, windowSec: 600 } }, async (ctx) => {
  const { token } = await ctx.body(tokenSchema);
  await verifyEmail(token);
  return { ok: true };
});
