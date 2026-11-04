import { applySchema } from "@myminijob/core";
import { NextResponse } from "next/server";
import { route } from "@/server/http";
import { apply, listApplicationsForListing } from "@/server/services/applications";

/** Submit an application. Requires header Idempotency-Key (one per slider/button gesture). */
export const POST = route<{ id: string }>({ auth: "required" }, async (ctx) => {
  const input = await ctx.body(applySchema);
  const key = ctx.req.headers.get("idempotency-key") ?? "";
  const { application, replayed } = await apply(ctx.user!, ctx.params.id, input, key);
  return NextResponse.json({ id: application.id, status: application.status, replayed }, { status: replayed ? 200 : 201 });
});

export const GET = route<{ id: string }>({ auth: "required" }, async (ctx) => listApplicationsForListing(ctx.user!, ctx.params.id));
