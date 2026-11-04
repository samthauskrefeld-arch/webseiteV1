import { reviewSchema } from "@myminijob/core";
import { route } from "@/server/http";
import { createReview } from "@/server/services/community";
export const POST = route<{ id: string }>({ auth: "required" }, async (ctx) => {
  const { rating, text } = await ctx.body(reviewSchema);
  const r = await createReview(ctx.user!, ctx.params.id, rating, text);
  return { id: r.review.id, moderated: r.moderated };
});
