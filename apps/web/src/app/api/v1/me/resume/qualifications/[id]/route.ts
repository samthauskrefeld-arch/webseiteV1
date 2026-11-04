import { route } from "@/server/http";
import { removeResumeQualification } from "@/server/services/profile";
export const DELETE = route<{ id: string }>({ auth: "required" }, async ({ user, params }) => {
  await removeResumeQualification(user!.id, params.id);
  return { ok: true };
});
