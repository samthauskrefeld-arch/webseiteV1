import { resumeSchema } from "@myminijob/core";
import { route } from "@/server/http";
import { updateResume } from "@/server/services/profile";
export const PUT = route({ auth: "required" }, async (ctx) => updateResume(ctx.user!.id, await ctx.body(resumeSchema)));
