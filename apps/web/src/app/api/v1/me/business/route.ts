import { businessSchema } from "@myminijob/core";
import { route } from "@/server/http";
import { getMyBusiness, upsertMyBusiness } from "@/server/services/community";
export const GET = route({ auth: "required" }, async ({ user }) => ({ business: await getMyBusiness(user!.id) }));
export const PUT = route({ auth: "required" }, async (ctx) => ({ business: await upsertMyBusiness(ctx.user!.id, await ctx.body(businessSchema)) }));
