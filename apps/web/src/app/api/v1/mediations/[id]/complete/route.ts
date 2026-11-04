import { route } from "@/server/http";
import { markCompleted } from "@/server/services/mediation";
export const POST = route<{ id: string }>({ auth: "required" }, async ({ user, params }) => {
  const m = await markCompleted(user!, params.id);
  return { status: m.status, posterCompletedAt: m.posterCompletedAt, applicantCompletedAt: m.applicantCompletedAt };
});
