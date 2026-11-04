import { route } from "@/server/http";
import { markConversationRead } from "@/server/services/chat";
export const POST = route<{ id: string }>({ auth: "required" }, async ({ user, params }) => {
  await markConversationRead(user!.id, params.id);
  return { ok: true };
});
