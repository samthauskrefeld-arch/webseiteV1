import { requestResetSchema } from "@myminijob/core";
import { route } from "@/server/http";
import { requestPasswordReset } from "@/server/services/auth";

export const POST = route({ auth: "none", rateLimit: { name: "reset-request", limit: 5, windowSec: 3600 } }, async (ctx) => {
  const { email } = await ctx.body(requestResetSchema);
  await requestPasswordReset(email);
  return { ok: true, message: "Wenn ein Konto zu dieser Adresse existiert, haben wir dir einen Link geschickt." };
});
