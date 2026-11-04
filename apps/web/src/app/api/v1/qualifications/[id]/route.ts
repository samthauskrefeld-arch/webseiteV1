import { route } from "@/server/http";
import { getQualification } from "@/server/services/catalog";
export const GET = route<{ id: string }>({ auth: "none" }, async ({ params }) => getQualification(params.id));
