/** All monetary values are integer cents. Never use floats for money. */
export type Cents = number;

const euroFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function formatEuro(cents: Cents): string {
  if (!Number.isInteger(cents)) throw new Error("Geldbeträge müssen ganzzahlige Cent sein");
  return euroFormatter.format(cents / 100).replace(/ /g, " ");
}

/** Parses "12,50", "12.50", "12" or "12,5" into cents. Returns null for invalid input. */
export function parseEuroToCents(raw: string): Cents | null {
  const s = raw.trim().replace(/\s|€|eur(o)?/gi, "");
  if (!/^\d{1,6}([.,]\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.replace(",", ".").split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function assertCents(value: unknown): asserts value is Cents {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Ungültiger Centbetrag");
  }
}
