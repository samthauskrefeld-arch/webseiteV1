import { changeRoleSchema } from "@myminijob/core";
import { route } from "@/server/http";
import { switchRole } from "@/server/services/auth";

export const PATCH = route({ auth: "required" }, async (ctx) => {
  const { role } = await ctx.body(changeRoleSchema);
  return switchRole(ctx.user!.id, role);
});
