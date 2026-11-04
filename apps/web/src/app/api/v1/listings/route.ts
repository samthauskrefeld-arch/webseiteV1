import { listingInputSchema } from "@myminijob/core";
import { NextResponse } from "next/server";
import { route } from "@/server/http";
import { createListing, latestListings } from "@/server/services/listings";

export const GET = route({ auth: "none" }, async () => ({ items: await latestListings(12) }));

export const POST = route({ auth: "required", rateLimit: { name: "listing-write", limit: 60, windowSec: 3600 } }, async (ctx) => {
  const input = await ctx.body(listingInputSchema);
  return NextResponse.json(await createListing(ctx.user!, input), { status: 201 });
});
