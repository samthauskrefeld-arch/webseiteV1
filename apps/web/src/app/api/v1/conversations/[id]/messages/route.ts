import { messageSchema } from "@myminijob/core";
import { z } from "zod";
import { NextResponse } from "next/server";
import { route } from "@/server/http";
import { getMessages, sendMessage } from "@/server/services/chat";

export const GET = route<{ id: string }>({ auth: "required" }, async (ctx) => {
  const { after } = ctx.query(z.object({ after: z.string().datetime().optional() }));
  return getMessages(ctx.user!.id, ctx.params.id, { after });
});
export const POST = route<{ id: string }>({ auth: "required" }, async (ctx) => {
  const input = await ctx.body(messageSchema);
  const r = await sendMessage(ctx.user!, ctx.params.id, input, ctx.req.headers.get("idempotency-key"));
  return NextResponse.json(r, { status: r.replayed ? 200 : 201 });
});
