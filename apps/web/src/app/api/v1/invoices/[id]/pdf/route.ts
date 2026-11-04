import { route } from "@/server/http";
import { renderInvoicePdf } from "@/server/services/invoices";
export const GET = route<{ id: string }>({ auth: "required" }, async ({ user, params }) => {
  const { number, pdf } = await renderInvoicePdf(user!, params.id);
  return new Response(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${number}.pdf"`, "Cache-Control": "private, no-store" } });
});
