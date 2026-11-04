/**
 * Business constants. Values marked LEGAL_REVIEW must be confirmed by counsel before go-live.
 */

/** Vermittlungsgebühr pro erfolgreich vermittelter Person (brutto, in Cent). */
export const MEDIATION_FEE_CENTS = 100;

/**
 * Version of the fee notice text shown before the binding confirmation.
 * Stored with every MediationEvent so it is provable which text the poster saw.
 * Bump when the text in `feeNoticeText()` changes.
 */
export const FEE_NOTICE_VERSION = "2026-11-04.1";

/** Days the applicant has to confirm an offer before it expires (no fee is charged on expiry). LEGAL_REVIEW */
export const OFFER_CONFIRMATION_DAYS = 7;

/** Days the poster may cancel a confirmed mediation for a fee refund (e.g. no-show). LEGAL_REVIEW */
export const CANCELLATION_WINDOW_DAYS = 14;

/** Payment term for fee invoices. LEGAL_REVIEW */
export const INVOICE_PAYMENT_TERM_DAYS = 14;

export type TaxMode = "KLEINUNTERNEHMER" | "REGULAR";

/**
 * Statutory minimum wage (Mindestlohngesetz) by effective date, in cents.
 * Source: Bundesregierung / Fünfte Mindestlohnanpassungsverordnung (13,90 € ab 01.01.2026, 14,60 € ab 01.01.2027).
 * Used only to WARN posters. It is not a hard block because exceptions exist
 * (e.g. Minderjährige ohne Berufsabschluss, Pflichtpraktika, Ehrenamt, echte Selbstständigkeit). LEGAL_REVIEW
 */
export const MINIMUM_WAGE_TABLE: ReadonlyArray<{ from: string; cents: number }> = [
  { from: "2025-01-01", cents: 1282 },
  { from: "2026-01-01", cents: 1390 },
  { from: "2027-01-01", cents: 1460 },
];

export function minimumWageCentsAt(date: Date = new Date()): number {
  const iso = date.toISOString().slice(0, 10);
  let current = MINIMUM_WAGE_TABLE[0]!.cents;
  for (const row of MINIMUM_WAGE_TABLE) if (row.from <= iso) current = row.cents;
  return current;
}

export const LIMITS = {
  listingTitleMax: 120,
  listingDescriptionMax: 8000,
  maxPositionsPerListing: 50,
  maxUploadBytes: 5 * 1024 * 1024,
  maxMessageLength: 4000,
  aiMessageMax: 2000,
  aiDailyRequestsPerUser: 60,
  aiDailyRequestsAnonymous: 15,
} as const;
