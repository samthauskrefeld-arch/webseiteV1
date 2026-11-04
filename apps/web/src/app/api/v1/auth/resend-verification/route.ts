import { route } from "@/server/http";
import { sendVerificationMail } from "@/server/services/auth";

export const POST = route({ auth: "required", rateLimit: { name: "resend-verify", limit: 3, windowSec: 3600 } }, async ({ user }) => {
  if (user!.emailVerified) return { ok: true, alreadyVerified: true };
  await sendVerificationMail(user!.id, user!.email);
  return { ok: true };
});
