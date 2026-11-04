import "server-only";
import { computeInvoiceAmounts, formatEuro, formatInvoiceNumber, INVOICE_PAYMENT_TERM_DAYS } from "@myminijob/core";
import type { MediationEvent } from "@myminijob/db";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { SessionUser } from "../auth/session";
import type { Tx } from "../db";
import { db } from "../db";
import { env } from "../env";
import { conflict, forbidden, notFound } from "../errors";

async function nextInvoiceNumber(tx: Tx, year: number) {
  // Atomic, gap-free within the transaction (rolled back together with the invoice).
  const rows = await tx.$queryRaw<Array<{ last: number }>>`
    INSERT INTO "InvoiceCounter" ("year", "last") VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "last" = "InvoiceCounter"."last" + 1
    RETURNING "last"`;
  return formatInvoiceNumber(year, rows[0]!.last);
}

async function recipientSnapshot(tx: Tx, mediation: Pick<MediationEvent, "posterId" | "listingId">) {
  const listing = await tx.listing.findUniqueOrThrow({ where: { id: mediation.listingId }, include: { business: true } });
  if (listing.business) {
    const b = listing.business;
    return { type: "BUSINESS", name: b.name, street: b.street, postalCode: b.postalCode, city: b.city, vatId: b.vatId };
  }
  const billing = await tx.billingAddress.findUnique({ where: { userId: mediation.posterId } });
  const profile = await tx.profile.findUnique({ where: { userId: mediation.posterId } });
  return billing
    ? { type: "PRIVATE", name: billing.name, street: billing.street, postalCode: billing.postalCode, city: billing.city, vatId: null }
    : // Kleinbetragsrechnung (≤ 250 € brutto, § 33 UStDV) needs no recipient address – LEGAL_REVIEW
      { type: "PRIVATE", name: profile?.username ?? "Kunde", street: null, postalCode: null, city: null, vatId: null };
}

/** Issues the fee invoice for a confirmed mediation. UNIQUE(mediationEventId, kind) guarantees at most one. */
export async function issueFeeInvoice(tx: Tx, mediation: MediationEvent) {
  const existing = await tx.invoice.findUnique({ where: { mediationEventId_kind: { mediationEventId: mediation.id, kind: "INVOICE" } } });
  if (existing) return existing;
  const now = new Date();
  const amounts = computeInvoiceAmounts(mediation.feeCents, env().INVOICE_TAX_MODE);
  const listing = await tx.listing.findUniqueOrThrow({ where: { id: mediation.listingId }, select: { title: true } });
  const applicant = await tx.profile.findUnique({ where: { userId: mediation.applicantId }, select: { username: true } });
  return tx.invoice.create({
    data: {
      number: await nextInvoiceNumber(tx, now.getUTCFullYear()),
      kind: "INVOICE",
      mediationEventId: mediation.id,
      recipientUserId: mediation.posterId,
      recipient: await recipientSnapshot(tx, mediation),
      description: `Vermittlungsgebühr: erfolgreiche Vermittlung von ${applicant?.username ?? "Person"} für „${listing.title.slice(0, 80)}“`,
      issueDate: now,
      serviceDate: mediation.confirmedAt ?? now,
      dueDate: new Date(now.getTime() + INVOICE_PAYMENT_TERM_DAYS * 86400_000),
      ...amounts,
      isTest: env().PAYMENT_PROVIDER === "test",
    },
  });
}

/** Storno: a separate correcting invoice with negative amounts; the original stays unchanged. */
export async function issueCancellationInvoice(tx: Tx, mediationEventId: string) {
  const original = await tx.invoice.findUnique({ where: { mediationEventId_kind: { mediationEventId, kind: "INVOICE" } } });
  if (!original) return null;
  const existing = await tx.invoice.findUnique({ where: { mediationEventId_kind: { mediationEventId, kind: "CANCELLATION" } } });
  if (existing) return existing;
  const now = new Date();
  const cancellation = await tx.invoice.create({
    data: {
      number: await nextInvoiceNumber(tx, now.getUTCFullYear()),
      kind: "CANCELLATION",
      mediationEventId,
      recipientUserId: original.recipientUserId,
      recipient: original.recipient as object,
      description: `Stornorechnung zu ${original.number}`,
      issueDate: now,
      serviceDate: original.serviceDate,
      dueDate: now,
      netCents: -original.netCents,
      taxCents: -original.taxCents,
      grossCents: -original.grossCents,
      taxRateBp: original.taxRateBp,
      taxNote: original.taxNote,
      status: "PAID",
      isTest: original.isTest,
      correctsInvoiceId: original.id,
    },
  });
  await tx.invoice.update({ where: { id: original.id }, data: { status: original.status === "PAID" ? "REFUNDED" : "CANCELLED" } });
  return cancellation;
}

export async function listMyInvoices(userId: string) {
  return db().invoice.findMany({ where: { recipientUserId: userId }, orderBy: { createdAt: "desc" }, include: { payments: { select: { status: true, isTest: true, createdAt: true } } } });
}

export async function getInvoice(user: SessionUser, id: string) {
  const inv = await db().invoice.findUnique({ where: { id }, include: { payments: true, corrects: { select: { number: true } } } });
  if (!inv) throw notFound("Rechnung");
  if (inv.recipientUserId !== user.id && !user.isAdmin) throw forbidden();
  return inv;
}

export async function saveBillingAddress(userId: string, a: { name: string; street: string; postalCode: string; city: string }) {
  return db().billingAddress.upsert({ where: { userId }, create: { userId, ...a }, update: a });
}

const fmtDate = (d: Date) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin" }).format(d);

/** PDF rendering with pdf-lib (no external services). */
export async function renderInvoicePdf(user: SessionUser, id: string): Promise<{ number: string; pdf: Uint8Array }> {
  const inv = await getInvoice(user, id);
  const e = env();
  const doc = await PDFDocument.create();
  doc.setTitle(`Rechnung ${inv.number}`);
  doc.setAuthor(e.OPERATOR_NAME);
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.14, 0.2);
  const muted = rgb(0.4, 0.45, 0.53);
  let y = 790;
  const text = (t: string, x: number, size = 10, f = font, color = ink) => page.drawText(t.replace(/[„“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\xFF€]/g, "?"), { x, y, size, font: f, color });
  text("My Minijob", 50, 20, bold);
  y -= 16;
  text(`${e.OPERATOR_NAME} · ${e.OPERATOR_ADDRESS}`, 50, 8, font, muted);
  y -= 12;
  text(`USt-IdNr./Steuernr.: ${e.OPERATOR_VAT_ID} · ${e.OPERATOR_EMAIL}`, 50, 8, font, muted);
  if (inv.isTest) {
    page.drawRectangle({ x: 380, y: 760, width: 165, height: 40, color: rgb(0.99, 0.93, 0.82) });
    page.drawText("TESTMODUS – keine echte", { x: 390, y: 784, size: 9, font: bold, color: rgb(0.66, 0.4, 0.04) });
    page.drawText("Rechnung, keine Zahlung", { x: 390, y: 771, size: 9, font: bold, color: rgb(0.66, 0.4, 0.04) });
  }
  y -= 50;
  const r = inv.recipient as { name?: string; street?: string | null; postalCode?: string | null; city?: string | null; vatId?: string | null };
  for (const line of [r.name, r.street, [r.postalCode, r.city].filter(Boolean).join(" "), r.vatId ? `USt-IdNr.: ${r.vatId}` : null].filter(Boolean) as string[]) {
    text(line, 50, 10);
    y -= 14;
  }
  y -= 30;
  text(inv.kind === "CANCELLATION" ? "Stornorechnung" : "Rechnung", 50, 16, bold);
  y -= 22;
  const meta: Array<[string, string]> = [
    ["Rechnungsnummer", inv.number],
    ["Rechnungsdatum", fmtDate(inv.issueDate)],
    ["Leistungsdatum", fmtDate(inv.serviceDate)],
    ...(inv.corrects ? ([["Korrigiert Rechnung", inv.corrects.number]] as Array<[string, string]>) : []),
    ...(inv.kind === "INVOICE" ? ([["Fällig bis", fmtDate(inv.dueDate)]] as Array<[string, string]>) : []),
  ];
  for (const [k, v] of meta) {
    text(k, 50, 10, font, muted);
    text(v, 180, 10);
    y -= 14;
  }
  y -= 24;
  page.drawLine({ start: { x: 50, y: y + 14 }, end: { x: 545, y: y + 14 }, thickness: 0.5, color: muted });
  text("Leistung", 50, 10, bold);
  text("Betrag", 480, 10, bold);
  y -= 18;
  const desc = inv.description;
  const words = desc.split(" ");
  let line = "";
  const lines: string[] = [];
  for (const w of words) {
    if ((line + " " + w).length > 70) {
      lines.push(line.trim());
      line = w;
    } else line += " " + w;
  }
  lines.push(line.trim());
  text(formatEuro(inv.grossCents), 480, 10);
  for (const l of lines) {
    text(l, 50, 10);
    y -= 14;
  }
  y -= 16;
  page.drawLine({ start: { x: 50, y: y + 14 }, end: { x: 545, y: y + 14 }, thickness: 0.5, color: muted });
  const totals: Array<[string, string]> = inv.taxRateBp
    ? [
        ["Nettobetrag", formatEuro(inv.netCents)],
        [`Umsatzsteuer ${inv.taxRateBp / 100} %`, formatEuro(inv.taxCents)],
        ["Gesamtbetrag", formatEuro(inv.grossCents)],
      ]
    : [["Gesamtbetrag", formatEuro(inv.grossCents)]];
  for (const [k, v] of totals) {
    text(k, 330, 10, k === "Gesamtbetrag" ? bold : font);
    text(v, 480, 10, k === "Gesamtbetrag" ? bold : font);
    y -= 14;
  }
  y -= 20;
  text(inv.taxNote, 50, 9, font, muted);
  y -= 14;
  if (inv.kind === "INVOICE") {
    text(`Bitte überweise den Betrag bis ${fmtDate(inv.dueDate)} unter Angabe der Rechnungsnummer an IBAN ${e.OPERATOR_IBAN}.`, 50, 9, font, muted);
    y -= 14;
  }
  text("Die Arbeitsvergütung ist nicht Bestandteil dieser Rechnung; sie wird direkt zwischen den Parteien gezahlt.", 50, 9, font, muted);
  y -= 14;
  text(`Status: ${{ OPEN: "offen", PAID: "bezahlt", CANCELLED: "storniert", REFUNDED: "erstattet" }[inv.status]}`, 50, 9, font, muted);
  return { number: inv.number, pdf: await doc.save() };
}

const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
const money = (c: number) => (c / 100).toFixed(2);

/**
 * E-invoice in UBL 2.1 syntax following the XRechnung CIUS structure.
 * DRAFT: must be validated with the KoSIT validator and completed (e.g. seller electronic address,
 * buyer reference) before relying on it for B2B e-invoicing obligations. See docs/LEGAL-REVIEW.md.
 */
export async function renderInvoiceXml(user: SessionUser, id: string) {
  const inv = await getInvoice(user, id);
  if (inv.kind === "CANCELLATION" && !inv.corrects) throw conflict("Stornorechnung ohne Bezug");
  const e = env();
  const r = inv.recipient as { name?: string; street?: string | null; postalCode?: string | null; city?: string | null; vatId?: string | null };
  const typeCode = inv.kind === "CANCELLATION" ? "381" : "380";
  const vatCategory = inv.taxRateBp ? "S" : "E";
  const d = (x: Date) => x.toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${xmlEscape(inv.number)}</cbc:ID>
  <cbc:IssueDate>${d(inv.issueDate)}</cbc:IssueDate>
  <cbc:DueDate>${d(inv.dueDate)}</cbc:DueDate>
  <cbc:InvoiceTypeCode>${typeCode}</cbc:InvoiceTypeCode>
  ${inv.isTest ? "<cbc:Note>TESTMODUS – keine echte Rechnung</cbc:Note>" : ""}
  <cbc:Note>${xmlEscape(inv.taxNote)}</cbc:Note>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${xmlEscape(inv.recipientUserId)}</cbc:BuyerReference>
  ${inv.corrects ? `<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${xmlEscape(inv.corrects.number)}</cbc:ID></cac:InvoiceDocumentReference></cac:BillingReference>` : ""}
  <cac:AccountingSupplierParty><cac:Party>
    <cbc:EndpointID schemeID="EM">${xmlEscape(e.OPERATOR_EMAIL)}</cbc:EndpointID>
    <cac:PostalAddress><cbc:StreetName>${xmlEscape(e.OPERATOR_ADDRESS)}</cbc:StreetName><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
    <cac:PartyTaxScheme><cbc:CompanyID>${xmlEscape(e.OPERATOR_VAT_ID)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
    <cac:PartyLegalEntity><cbc:RegistrationName>${xmlEscape(e.OPERATOR_NAME)}</cbc:RegistrationName></cac:PartyLegalEntity>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PostalAddress>${r.street ? `<cbc:StreetName>${xmlEscape(r.street)}</cbc:StreetName>` : ""}${r.city ? `<cbc:CityName>${xmlEscape(r.city)}</cbc:CityName>` : ""}${r.postalCode ? `<cbc:PostalZone>${xmlEscape(r.postalCode)}</cbc:PostalZone>` : ""}<cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
    ${r.vatId ? `<cac:PartyTaxScheme><cbc:CompanyID>${xmlEscape(r.vatId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ""}
    <cac:PartyLegalEntity><cbc:RegistrationName>${xmlEscape(r.name ?? "")}</cbc:RegistrationName></cac:PartyLegalEntity>
  </cac:Party></cac:AccountingCustomerParty>
  <cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode><cac:PayeeFinancialAccount><cbc:ID>${xmlEscape(e.OPERATOR_IBAN)}</cbc:ID></cac:PayeeFinancialAccount></cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${money(inv.taxCents)}</cbc:TaxAmount>
    <cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">${money(inv.netCents)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">${money(inv.taxCents)}</cbc:TaxAmount>
      <cac:TaxCategory><cbc:ID>${vatCategory}</cbc:ID><cbc:Percent>${(inv.taxRateBp / 100).toFixed(2)}</cbc:Percent>${vatCategory === "E" ? "<cbc:TaxExemptionReason>Kleinunternehmer gemäß § 19 UStG</cbc:TaxExemptionReason>" : ""}<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${money(inv.netCents)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${money(inv.netCents)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${money(inv.grossCents)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${money(inv.status === "PAID" && inv.kind === "INVOICE" ? 0 : inv.grossCents)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">${inv.kind === "CANCELLATION" ? "-1" : "1"}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${money(inv.netCents)}</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>${xmlEscape(inv.description.slice(0, 200))}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${vatCategory}</cbc:ID><cbc:Percent>${(inv.taxRateBp / 100).toFixed(2)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">${money(Math.abs(inv.netCents))}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>`;
  return { number: inv.number, xml };
}
