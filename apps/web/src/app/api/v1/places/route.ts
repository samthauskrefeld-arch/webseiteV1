import { z } from "zod";
import { route } from "@/server/http";
import { searchPlaces } from "@/server/services/catalog";
export const GET = route({ auth: "none", rateLimit: { name: "places", limit: 240, windowSec: 60 } }, async (ctx) => {
  const { q } = ctx.query(z.object({ q: z.string().max(80).default("") }));
  return { items: await searchPlaces(q) };
});
