import { z } from "zod";
import { route } from "@/server/http";
import { parseNaturalQuery } from "@/server/services/search";
export const POST = route({ auth: "optional", rateLimit: { name: "search-parse", limit: 60, windowSec: 60 } }, async (ctx) => {
  const { q } = await ctx.body(z.object({ q: z.string().min(1).max(300) }));
  return parseNaturalQuery(q, { clientKey: ctx.clientKey, userId: ctx.user?.id });
});
