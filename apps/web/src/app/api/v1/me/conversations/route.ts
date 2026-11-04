import { route } from "@/server/http";
import { listConversations } from "@/server/services/chat";
export const GET = route({ auth: "required" }, async ({ user }) => ({ items: await listConversations(user!.id) }));
