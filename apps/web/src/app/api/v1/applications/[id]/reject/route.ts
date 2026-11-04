import { applicationNoteSchema } from "@myminijob/core";
import { route } from "@/server/http";
import { rejectApplication } from "@/server/services/applications";
export const POST = route<{ id: string }>({ auth: "required" }, async (ctx) => {
  const { note } = await ctx.body(applicationNoteSchema);
  return rejectApplication(ctx.user!, ctx.params.id, note);
});
