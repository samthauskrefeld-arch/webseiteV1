import { resumeQualificationSchema } from "@myminijob/core";
import { route } from "@/server/http";
import { addResumeQualification } from "@/server/services/profile";
export const POST = route({ auth: "required" }, async (ctx) => {
  const { qualificationId, note, documentFileId } = await ctx.body(resumeQualificationSchema);
  return addResumeQualification(ctx.user!.id, qualificationId, note, documentFileId);
});
