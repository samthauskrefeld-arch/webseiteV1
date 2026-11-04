import { billingAddressSchema } from "@myminijob/core";
import { db } from "@/server/db";
import { route } from "@/server/http";
import { saveBillingAddress } from "@/server/services/invoices";
export const GET = route({ auth: "required" }, async ({ user }) => ({ address: await db().billingAddress.findUnique({ where: { userId: user!.id } }) }));
export const PUT = route({ auth: "required" }, async (ctx) => ({ address: await saveBillingAddress(ctx.user!.id, await ctx.body(billingAddressSchema)) }));
