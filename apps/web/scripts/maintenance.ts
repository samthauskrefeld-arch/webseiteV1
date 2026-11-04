/**
 * Periodic maintenance (run e.g. every 15 minutes via cron / scheduler):
 *   pnpm --filter @myminijob/web maintenance
 * - expires unanswered offers (no fee)
 * - removes expired sessions and used/expired tokens
 */
import "dotenv/config";
import { db } from "@/server/db";
import { expireStaleOffers } from "@/server/services/mediation";

async function main() {
  const expired = await expireStaleOffers();
  const sessions = await db().session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const tokens = await db().verificationToken.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] } });
  console.log(JSON.stringify({ level: "info", event: "maintenance", expiredOffers: expired, sessions: sessions.count, tokens: tokens.count }));
  await db().$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
