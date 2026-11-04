import { z } from "zod";
import { db } from "@/server/db";
import { route } from "@/server/http";

/** Nearest known place to browser coordinates (only called after explicit geolocation consent). Coordinates are not stored. */
export const GET = route({ auth: "none", rateLimit: { name: "nearest", limit: 30, windowSec: 60 } }, async (ctx) => {
  const { lat, lng } = ctx.query(z.object({ lat: z.coerce.number().min(47).max(55.5), lng: z.coerce.number().min(5.5).max(15.5) }));
  const rows = await db().$queryRaw<Array<{ name: string; km: number }>>`
    SELECT "name", 2 * 6371 * asin(sqrt(power(sin(radians("lat" - ${lat}) / 2), 2) + cos(radians(${lat})) * cos(radians("lat")) * power(sin(radians("lng" - ${lng}) / 2), 2))) AS km
    FROM "Place" ORDER BY km ASC LIMIT 1`;
  const r = rows[0];
  return { place: r && r.km < 40 ? { name: r.name, km: Math.round(Number(r.km)) } : null };
});
