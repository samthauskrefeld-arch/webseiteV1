import "server-only";
import webpush from "web-push";
import { db } from "../db";
import { env } from "../env";

let configured: boolean | null = null;
function ensure() {
  if (configured !== null) return configured;
  const e = env();
  configured = !!(e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY);
  if (configured) webpush.setVapidDetails(e.VAPID_SUBJECT, e.VAPID_PUBLIC_KEY!, e.VAPID_PRIVATE_KEY!);
  return configured;
}

export const pushEnabled = () => ensure();
export const pushPublicKey = () => (ensure() ? env().VAPID_PUBLIC_KEY! : null);

/** Sends a Web Push to all subscriptions of a user. No-op without VAPID keys. */
export async function sendPush(userId: string, payload: { title: string; body: string; link?: string }) {
  if (!ensure()) return 0;
  const subs = await db().pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db().pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
    }
  }
  return sent;
}
