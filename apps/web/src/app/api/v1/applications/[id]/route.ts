import { route } from "@/server/http";
import { getApplication } from "@/server/services/applications";
export const GET = route<{ id: string }>({ auth: "required" }, async ({ user, params }) => getApplication(user!, params.id));
