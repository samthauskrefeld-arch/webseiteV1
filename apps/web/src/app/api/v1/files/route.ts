import { LIMITS } from "@myminijob/core";
import { NextResponse } from "next/server";
import { ApiError } from "@/server/errors";
import { route } from "@/server/http";
import { uploadFile } from "@/server/services/files";

const PURPOSES = ["RESUME_DOC", "QUALIFICATION_PROOF", "CHAT_ATTACHMENT", "BUSINESS_DOC"] as const;

/** multipart/form-data: file, purpose */
export const POST = route({ auth: "required", rateLimit: { name: "upload", limit: 30, windowSec: 3600 } }, async (ctx) => {
  const len = Number(ctx.req.headers.get("content-length") ?? 0);
  if (len > LIMITS.maxUploadBytes + 64 * 1024) throw new ApiError("PAYLOAD_TOO_LARGE", "Datei zu groß (max. 5 MB)");
  const form = await ctx.req.formData().catch(() => null);
  const file = form?.get("file");
  const purpose = String(form?.get("purpose") ?? "");
  if (!(file instanceof File)) throw new ApiError("BAD_REQUEST", "Datei fehlt");
  if (!(PURPOSES as readonly string[]).includes(purpose)) throw new ApiError("BAD_REQUEST", "Ungültiger Zweck");
  const data = Buffer.from(await file.arrayBuffer());
  const saved = await uploadFile(ctx.user!.id, purpose as (typeof PURPOSES)[number], file.name, data);
  return NextResponse.json(saved, { status: 201 });
});
