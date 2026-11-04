import { route } from "@/server/http";
import { withdrawOffer } from "@/server/services/mediation";
export const POST = route<{ id: string }>({ auth: "required" }, async ({ user, params }) => {
  const m = await withdrawOffer(user!, params.id);
  return { status: m.status };
});
