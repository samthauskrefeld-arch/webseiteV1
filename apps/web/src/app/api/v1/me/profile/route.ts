import { profileSchema } from "@myminijob/core";
import { route } from "@/server/http";
import { getMyProfile, updateProfile } from "@/server/services/profile";
export const GET = route({ auth: "required" }, async ({ user }) => getMyProfile(user!.id));
export const PUT = route({ auth: "required" }, async (ctx) => updateProfile(ctx.user!.id, await ctx.body(profileSchema)));
