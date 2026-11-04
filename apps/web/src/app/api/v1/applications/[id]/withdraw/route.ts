import { route } from "@/server/http";
import { withdrawApplication } from "@/server/services/applications";
export const POST = route<{ id: string }>({ auth: "required" }, async ({ user, params }) => withdrawApplication(user!, params.id));
