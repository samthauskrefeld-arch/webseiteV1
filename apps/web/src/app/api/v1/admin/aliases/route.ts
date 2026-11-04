import { aliasSchema } from "@myminijob/core";
import { route } from "@/server/http";
import { addAlias } from "@/server/services/catalog";
export const POST = route({ auth: "admin" }, async (ctx) => {
  const { qualificationId, alias, kind } = await ctx.body(aliasSchema);
  return addAlias(qualificationId, alias, kind, ctx.user!.id);
});
