import { route } from "@/server/http";
import { shortlistApplication } from "@/server/services/applications";
export const POST = route<{ id: string }>({ auth: "required" }, async ({ user, params }) => shortlistApplication(user!, params.id));
