import { z } from "zod";
import { QUALIFICATION_KINDS } from "@myminijob/core";
import { route } from "@/server/http";
import { searchQualifications } from "@/server/services/catalog";

const q = z.object({ q: z.string().max(80).default(""), kinds: z.string().optional(), limit: z.coerce.number().int().min(1).max(20).default(10) });

export const GET = route({ auth: "none", rateLimit: { name: "qual-ac", limit: 240, windowSec: 60 } }, async (ctx) => {
  const { q: term, kinds, limit } = ctx.query(q);
  const kindList = kinds?.split(",").filter((k): k is (typeof QUALIFICATION_KINDS)[number] => (QUALIFICATION_KINDS as readonly string[]).includes(k));
  return { items: await searchQualifications(term, kindList, limit) };
});
