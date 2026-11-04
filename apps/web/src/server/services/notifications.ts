import "server-only";
import { NOTIFICATION_TYPES, type NotificationType } from "@myminijob/core";
import { appLink, sendMail } from "../adapters/mail";
import { sendPush } from "../adapters/push";
import { publishRealtime } from "../adapters/redis";
import { db } from "../db";
import { logError } from "../log";

const DEFAULTS: Record<NotificationType, { email: boolean; push: boolean; inApp: boolean }> = {
  APPLICATION_RECEIVED: { email: true, push: true, inApp: true },
  APPLICATION_STATUS: { email: true, push: true, inApp: true },
  OFFER_RECEIVED: { email: true, push: true, inApp: true },
  OFFER_RESPONSE: { email: true, push: true, inApp: true },
  MESSAGE: { email: false, push: true, inApp: true },
  INVOICE: { email: true, push: false, inApp: true },
  REVIEW: { email: false, push: false, inApp: true },
  SYSTEM: { email: true, push: false, inApp: true },
};

export async function getPreferences(userId: string) {
  const rows = await db().notificationPreference.findMany({ where: { userId } });
  return NOTIFICATION_TYPES.map((type) => {
    const r = rows.find((x) => x.type === type);
    return { type, ...(r ? { email: r.email, push: r.push, inApp: r.inApp } : DEFAULTS[type]) };
  });
}

export async function setPreferences(userId: string, prefs: Array<{ type: NotificationType; email: boolean; push: boolean; inApp: boolean }>) {
  await db().$transaction(
    prefs.map((p) =>
      db().notificationPreference.upsert({
        where: { userId_type: { userId, type: p.type } },
        create: { userId, ...p },
        update: { email: p.email, push: p.push, inApp: p.inApp },
      }),
    ),
  );
  return getPreferences(userId);
}

/**
 * Creates an in-app notification and dispatches e-mail/push according to the user's preferences.
 * Never includes message contents or private contact data in e-mails.
 * SYSTEM mails (verification, password reset) are sent directly, not through here.
 */
export async function notify(userId: string, type: NotificationType, title: string, body: string, link?: string) {
  try {
    const prefs = (await getPreferences(userId)).find((p) => p.type === type) ?? DEFAULTS[type];
    const n = prefs.inApp ? await db().notification.create({ data: { userId, type, title, body, link } }) : null;
    if (n) await publishRealtime(`user:${userId}`, { type: "notification", id: n.id });
    const user = await db().user.findUnique({ where: { id: userId }, select: { email: true, status: true } });
    if (!user || user.status !== "ACTIVE") return;
    if (prefs.email) {
      await sendMail(user.email, `My Minijob: ${title}`, `${body}\n\n${link ? appLink(link) : appLink("/konto")}\n\nBenachrichtigungen kannst du unter ${appLink("/konto/einstellungen")} anpassen.`);
      if (n) await db().notification.update({ where: { id: n.id }, data: { emailedAt: new Date() } });
    }
    if (prefs.push) await sendPush(userId, { title, body, link });
  } catch (e) {
    logError("notify_failed", e, { type });
  }
}

export async function listNotifications(userId: string) {
  const [items, unread] = await Promise.all([
    db().notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    db().notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, unread };
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  await db().notification.updateMany({ where: { userId, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
}
