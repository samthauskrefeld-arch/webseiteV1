import { FEE_NOTICE_VERSION, MEDIATION_FEE_CENTS, type TaxMode } from "./config";
import { formatEuro } from "./money";

export interface InvoiceAmounts {
  netCents: number;
  taxCents: number;
  grossCents: number;
  /** Tax rate in basis points (1900 = 19 %). */
  taxRateBp: number;
  taxNote: string;
}

/**
 * The fee is communicated as a gross price of exactly 1,00 €.
 * REGULAR: 19 % USt. is included (net = round(gross / 1.19)).
 * KLEINUNTERNEHMER: no USt. shown, note per § 19 UStG. LEGAL_REVIEW
 */
export function computeInvoiceAmounts(grossCents: number, mode: TaxMode): InvoiceAmounts {
  if (!Number.isSafeInteger(grossCents) || grossCents < 0) throw new Error("Ungültiger Betrag");
  if (mode === "KLEINUNTERNEHMER") {
    return {
      netCents: grossCents,
      taxCents: 0,
      grossCents,
      taxRateBp: 0,
      taxNote: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
    };
  }
  const netCents = Math.round((grossCents * 10000) / 11900);
  return {
    netCents,
    taxCents: grossCents - netCents,
    grossCents,
    taxRateBp: 1900,
    taxNote: "Im Betrag sind 19 % Umsatzsteuer enthalten.",
  };
}

export function feeNoticeText(listingTitle: string, applicantName: string): string {
  return (
    `Mit der verbindlichen Zusage an ${applicantName} für „${listingTitle}“ entsteht – sobald ` +
    `${applicantName} die Zusage annimmt – eine Vermittlungsgebühr von ${formatEuro(MEDIATION_FEE_CENTS)} ` +
    `(einmalig, pro Person). Lehnt die Person ab oder antwortet nicht rechtzeitig, fällt keine Gebühr an. ` +
    `Die Arbeitsvergütung vereinbart und zahlt ihr direkt untereinander; My Minijob zahlt keine Löhne aus.`
  );
}

export const FEE_BUTTON_LABEL = "Zahlungspflichtig zusagen (1,00 €)";
export { FEE_NOTICE_VERSION };

export function formatInvoiceNumber(year: number, sequence: number): string {
  return `MMJ-${year}-${String(sequence).padStart(6, "0")}`;
}
