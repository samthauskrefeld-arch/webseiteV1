import { route } from "@/server/http";
import { listMyOffers } from "@/server/services/mediation";
export const GET = route({ auth: "required" }, async ({ user }) => ({ items: await listMyOffers(user!.id) }));
