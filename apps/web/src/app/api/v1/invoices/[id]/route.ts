import { route } from "@/server/http";
import { getInvoice } from "@/server/services/invoices";
import { paymentMode } from "@/server/services/payments";
export const GET = route<{ id: string }>({ auth: "required" }, async ({ user, params }) => ({ invoice: await getInvoice(user!, params.id), payment: paymentMode() }));
