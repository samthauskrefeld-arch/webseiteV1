import { route } from "@/server/http";
import { listMyApplications } from "@/server/services/applications";
export const GET = route({ auth: "required" }, async ({ user }) => ({ items: await listMyApplications(user!.id) }));
