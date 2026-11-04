import { route } from "@/server/http";
import { listMyFiles } from "@/server/services/files";
export const GET = route({ auth: "required" }, async ({ user }) => ({ items: await listMyFiles(user!.id) }));
