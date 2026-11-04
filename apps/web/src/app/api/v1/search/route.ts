import { z } from "zod";
import { searchQuerySchema } from "@myminijob/core";
import { route } from "@/server/http";
import { parseNaturalQuery, searchListings } from "@/server/services/search";

const params = z.object({
  q: z.string().max(300).optional(),
  /** JSON-encoded structured filters (chips edited in the UI); overrides parsed values */
  filters: z.string().max(2000).optional(),
  page: z.coerce.number().int().min(1).max(50).default(1),
  ai: z.enum(["0", "1"]).default("1"),
});

export const GET = route({ auth: "optional", rateLimit: { name: "search", limit: 120, windowSec: 60 } }, async (ctx) => {
  const p = ctx.query(params);
  let parsed = p.q ? await parseNaturalQuery(p.q, { clientKey: ctx.clientKey, userId: ctx.user?.id, useAi: p.ai === "1" }) : null;
  let query = parsed?.query ?? {};
  if (p.filters) {
    let raw: unknown;
    try { raw = JSON.parse(p.filters); } catch { raw = {}; }
    query = searchQuerySchema.parse(raw);
    parsed = null;
  }
  const result = await searchListings(query, p.page);
  return { query, parser: parsed?.parser ?? "filters", chips: parsed?.chips ?? null, ...result };
});
