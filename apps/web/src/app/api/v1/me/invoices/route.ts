import { route } from "@/server/http";
import { listMyInvoices } from "@/server/services/invoices";
import { paymentMode } from "@/server/services/payments";
export const GET = route({ auth: "required" }, async ({ user }) => ({ items: await listMyInvoices(user!.id), payment: paymentMode() }));
