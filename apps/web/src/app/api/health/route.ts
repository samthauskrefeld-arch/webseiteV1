import { db } from "@/server/db";
import { getRedis } from "@/server/adapters/redis";
export const dynamic = "force-dynamic";
export async function GET() {
  const checks: Record<string, string> = {};
  try {
    await db().$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }
  const r = getRedis();
  checks.redis = r ? await r.ping().then(() => "ok").catch(() => "error") : "not_configured";
  const ok = checks.database === "ok";
  return Response.json({ status: ok ? "ok" : "degraded", checks }, { status: ok ? 200 : 503 });
}
