import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { db } from "../db";
import { env } from "../env";
import { logError } from "../log";

let transporter: Transporter | null | undefined;
function getTransport() {
  if (transporter !== undefined) return transporter;
  const e = env();
  transporter = e.SMTP_HOST
    ? nodemailer.createTransport({
        host: e.SMTP_HOST,
        port: e.SMTP_PORT,
        secure: e.SMTP_PORT === 465,
        auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASS } : undefined,
      })
    : null;
  return transporter;
}

/**
 * Every outgoing mail is recorded in OutboxEmail (status + error) for traceability.
 * Without SMTP the record is the only delivery (dev inbox at /dev/mails).
 */
export async function sendMail(to: string, subject: string, text: string) {
  const record = await db().outboxEmail.create({ data: { to, subject, text } });
  const t = getTransport();
  if (!t) return { delivered: false, id: record.id };
  try {
    await t.sendMail({ from: env().MAIL_FROM, to, subject, text });
    await db().outboxEmail.update({ where: { id: record.id }, data: { sentAt: new Date() } });
    return { delivered: true, id: record.id };
  } catch (e) {
    logError("mail_send_failed", e, { outboxId: record.id });
    await db().outboxEmail.update({ where: { id: record.id }, data: { error: (e as Error).message.slice(0, 500) } });
    return { delivered: false, id: record.id };
  }
}

export function appLink(path: string) {
  return new URL(path, env().APP_URL).toString();
}
