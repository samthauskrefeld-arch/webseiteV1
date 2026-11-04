import { listingInputSchema } from "@myminijob/core";
import { route } from "@/server/http";
import { getListing, updateListing } from "@/server/services/listings";

export const GET = route<{ id: string }>({ auth: "optional" }, async ({ params, user }) => getListing(params.id, user));
export const PUT = route<{ id: string }>({ auth: "required", rateLimit: { name: "listing-write", limit: 60, windowSec: 3600 } }, async (ctx) =>
  updateListing(ctx.user!, ctx.params.id, await ctx.body(listingInputSchema)),
);
