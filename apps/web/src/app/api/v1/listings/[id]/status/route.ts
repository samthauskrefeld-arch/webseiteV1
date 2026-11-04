import { listingActionSchema } from "@myminijob/core";
import { route } from "@/server/http";
import { changeListingStatus } from "@/server/services/listings";
export const POST = route<{ id: string }>({ auth: "required" }, async (ctx) => {
  const { action } = await ctx.body(listingActionSchema);
  return changeListingStatus(ctx.user!, ctx.params.id, action);
});
