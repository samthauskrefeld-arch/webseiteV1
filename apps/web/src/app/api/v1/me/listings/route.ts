import { route } from "@/server/http";
import { listMyListings } from "@/server/services/listings";
export const GET = route({ auth: "required" }, async ({ user }) => ({ items: await listMyListings(user!.id) }));
