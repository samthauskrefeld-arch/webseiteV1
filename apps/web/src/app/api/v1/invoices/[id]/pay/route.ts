import { route } from "@/server/http";
import { payInvoice } from "@/server/services/payments";
export const POST = route<{ id: string }>({ auth: "required", rateLimit: { name: "pay", limit: 20, windowSec: 3600 } }, async (ctx) => {
  const { payment, replayed } = await payInvoice(ctx.user!, ctx.params.id, ctx.req.headers.get("idempotency-key") ?? "");
  return { paymentId: payment.id, status: payment.status, isTest: payment.isTest, replayed };
});
