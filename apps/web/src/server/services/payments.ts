import "server-only";
import { randomUUID } from "node:crypto";
import type { SessionUser } from "../auth/session";
import { audit } from "../audit";
import type { Tx } from "../db";
import { db } from "../db";
import { env } from "../env";
import { ApiError, conflict, forbidden, notFound } from "../errors";

/**
 * Payment provider abstraction. Only the TEST adapter exists: it moves no money and
 * marks everything isTest=true. A live provider (e.g. SEPA direct debit / PSP) must only be added
 * after contracts and legal review (Zahlungsdiensteaufsichtsgesetz, PSP terms) – see OPEN-ITEMS.
 */
interface PaymentProvider {
  id: string;
  isTest: boolean;
  charge(amountCents: number, reference: string): Promise<{ status: "SUCCEEDED" | "FAILED" | "PENDING"; providerRef: string }>;
  refund(providerRef: string, amountCents: number): Promise<{ ok: boolean }>;
}

const testProvider: PaymentProvider = {
  id: "test",
  isTest: true,
  async charge(_amount, reference) {
    return { status: "SUCCEEDED", providerRef: `test_${reference}_${randomUUID().slice(0, 8)}` };
  },
  async refund() {
    return { ok: true };
  },
};

function provider(): PaymentProvider {
  const p = env().PAYMENT_PROVIDER;
  if (p === "test") return testProvider;
  throw new ApiError("UNAVAILABLE", "Kein Zahlungsanbieter konfiguriert");
}

export const paymentMode = () => ({ provider: provider().id, isTest: provider().isTest });

/** Pays an invoice exactly once per idempotency key; already-paid invoices are not charged again. */
export async function payInvoice(user: SessionUser, invoiceId: string, idempotencyKey: string) {
  if (!/^[\w-]{16,100}$/.test(idempotencyKey)) throw new ApiError("BAD_REQUEST", "Idempotency-Key fehlt oder ist ungültig");
  const replay = await db().payment.findUnique({ where: { idempotencyKey } });
  if (replay) {
    if (replay.invoiceId !== invoiceId) throw conflict("Idempotency-Key wurde bereits verwendet");
    return { payment: replay, replayed: true };
  }
  const p = provider();
  return db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId}::uuid FOR UPDATE`;
    const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw notFound("Rechnung");
    if (inv.recipientUserId !== user.id) throw forbidden();
    const raced = await tx.payment.findUnique({ where: { idempotencyKey } });
    if (raced) return { payment: raced, replayed: true };
    if (inv.kind !== "INVOICE") throw conflict("Stornorechnungen werden nicht bezahlt.");
    if (inv.status !== "OPEN") throw conflict(inv.status === "PAID" ? "Rechnung ist bereits bezahlt." : "Rechnung ist nicht mehr offen.");
    const result = await p.charge(inv.grossCents, inv.number);
    const payment = await tx.payment.create({
      data: { invoiceId: inv.id, provider: p.id, providerRef: result.providerRef, amountCents: inv.grossCents, status: result.status, idempotencyKey, isTest: p.isTest },
    });
    if (result.status === "SUCCEEDED") await tx.invoice.update({ where: { id: inv.id }, data: { status: "PAID" } });
    await audit({ actorId: user.id, action: "payment.charge", entityType: "Invoice", entityId: inv.id, data: { status: result.status, isTest: p.isTest, amountCents: inv.grossCents } }, tx);
    return { payment, replayed: false };
  });
}

export async function refundInvoicePayments(tx: Tx, mediationEventId: string) {
  const inv = await tx.invoice.findUnique({ where: { mediationEventId_kind: { mediationEventId, kind: "INVOICE" } }, include: { payments: true } });
  if (!inv) return;
  const p = provider();
  for (const pay of inv.payments.filter((x) => x.status === "SUCCEEDED")) {
    await p.refund(pay.providerRef ?? "", pay.amountCents);
    await tx.payment.update({ where: { id: pay.id }, data: { status: "REFUNDED" } });
    await tx.payment.create({ data: { invoiceId: inv.id, provider: p.id, providerRef: `refund_${pay.providerRef}`, amountCents: -pay.amountCents, status: "SUCCEEDED", idempotencyKey: `refund-${pay.id}`, isTest: p.isTest } });
  }
}
