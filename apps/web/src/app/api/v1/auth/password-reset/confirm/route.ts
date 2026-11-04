import { resetPasswordSchema } from "@myminijob/core";
import { route } from "@/server/http";
import { resetPassword } from "@/server/services/auth";

export const POST = route({ auth: "none", rateLimit: { name: "reset-confirm", limit: 10, windowSec: 3600 } }, async (ctx) => {
  const { token, password } = await ctx.body(resetPasswordSchema);
  await resetPassword(token, password);
  return { ok: true };
});
