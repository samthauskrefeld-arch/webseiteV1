import { route } from "@/server/http";
import { renderInvoiceXml } from "@/server/services/invoices";
export const GET = route<{ id: string }>({ auth: "required" }, async ({ user, params }) => {
  const { number, xml } = await renderInvoiceXml(user!, params.id);
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="${number}.xml"`, "Cache-Control": "private, no-store" } });
});
