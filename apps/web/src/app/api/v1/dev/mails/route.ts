import { db } from "@/server/db";
import { ApiError } from "@/server/errors";
import { route } from "@/server/http";

/** Development inbox (OutboxEmail). Disabled in production. */
export const GET = route({ auth: "none" }, async () => {
  if (process.env.NODE_ENV === "production") throw new ApiError("NOT_FOUND", "Nicht verfügbar");
  return { items: await db().outboxEmail.findMany({ orderBy: { createdAt: "desc" }, take: 50 }) };
});
