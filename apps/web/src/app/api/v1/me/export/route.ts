import { route } from "@/server/http";
import { exportMyData } from "@/server/services/privacy";
export const GET = route({ auth: "required", rateLimit: { name: "export", limit: 5, windowSec: 3600 } }, async ({ user }) => {
  const data = await exportMyData(user!.id);
  return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="my-minijob-datenexport.json"', "Cache-Control": "no-store" } });
});
