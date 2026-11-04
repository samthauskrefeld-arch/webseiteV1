import { route } from "@/server/http";
import { getPublicProfile } from "@/server/services/profile";
export const GET = route<{ username: string }>({ auth: "none" }, async ({ params }) => {
  const { userId: _u, ...p } = await getPublicProfile(decodeURIComponent(params.username));
  return p;
});
