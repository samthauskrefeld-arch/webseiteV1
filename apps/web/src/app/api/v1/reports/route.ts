import { reportSchema } from "@myminijob/core";
import { NextResponse } from "next/server";
import { route } from "@/server/http";
import { createReport } from "@/server/services/community";
export const POST = route({ auth: "required" }, async (ctx) => {
  const r = await createReport(ctx.user!, await ctx.body(reportSchema));
  return NextResponse.json({ id: r.id }, { status: 201 });
});
