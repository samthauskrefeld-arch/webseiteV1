import { route } from "@/server/http";
import { blockUser, unblockUser } from "@/server/services/chat";
export const POST = route<{ id: string }>({ auth: "required" }, async ({ user, params }) => {
  await blockUser(user!.id, params.id);
  return { blocked: true };
});
export const DELETE = route<{ id: string }>({ auth: "required" }, async ({ user, params }) => {
  await unblockUser(user!.id, params.id);
  return { blocked: false };
});
