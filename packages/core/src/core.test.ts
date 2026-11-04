import { describe, expect, it } from "vitest";
import {
  canTransitionApplication,
  computeInvoiceAmounts,
  formatEuro,
  formatInvoiceNumber,
  listingInputSchema,
  minimumWageCentsAt,
  nextListingStatus,
  normalizeText,
  parseEuroToCents,
  parseSearchRules,
  registerSchema,
  sanitizeAiQuery,
  findHelpArticle,
} from "./index";

const known = new Set(["krefeld", "dortmund", "koeln", "muenchen", "berlin"]);
const opts = { isKnownPlace: (t: string) => known.has(t) };

describe("normalizeText", () => {
  it("folds umlauts, gender suffixes and punctuation", () => {
    expect(normalizeText("Elektroniker/-in für Betriebstechnik")).toBe("elektroniker fuer betriebstechnik");
    expect(normalizeText("Kaufmann/-frau für Büromanagement")).toBe("kaufmann frau fuer bueromanagement");
    expect(normalizeText("  Straße  ")).toBe("strasse");
  });
});

describe("money", () => {
  it("parses German euro notation into integer cents", () => {
    expect(parseEuroToCents("12,50")).toBe(1250);
    expect(parseEuroToCents("12,5")).toBe(1250);
    expect(parseEuroToCents("15")).toBe(1500);
    expect(parseEuroToCents("13.90 €")).toBe(1390);
    expect(parseEuroToCents("abc")).toBeNull();
  });
  it("formats cents", () => {
    expect(formatEuro(100)).toBe("1,00 €");
    expect(() => formatEuro(1.5)).toThrow();
  });
});

describe("parseSearchRules", () => {
  it("parses 'Gartenarbeit ab 12,50 Euro Raum Krefeld'", () => {
    const q = parseSearchRules("Gartenarbeit ab 12,50 Euro Raum Krefeld", opts);
    expect(q).toMatchObject({ category: "GARTEN", minHourlyCents: 1250, location: "Krefeld", radiusKm: 25 });
  });
  it("parses 'Wochenendjob Dortmund mindestens 15 Euro' using the place resolver", () => {
    const q = parseSearchRules("Wochenendjob Dortmund mindestens 15 Euro", opts);
    expect(q).toMatchObject({ weekend: true, location: "Dortmund", minHourlyCents: 1500 });
    expect(q.text).toBeUndefined();
  });
  it("does not invent a location when none is given", () => {
    const q = parseSearchRules("Nachhilfe Mathe", opts);
    expect(q.location).toBeUndefined();
    expect(q.category).toBe("NACHHILFE");
    expect(q.text).toContain("mathe");
  });
  it("does not treat 'in Teilzeit' as a location", () => {
    const q = parseSearchRules("Bürojob in Teilzeit in Köln im Umkreis von 10 km", opts);
    expect(q).toMatchObject({ location: "Köln", radiusKm: 10, category: "BUERO", employmentTypes: ["TEILZEIT"] });
  });
  it("accepts postal codes", () => {
    expect(parseSearchRules("Haushaltshilfe 47798", opts)).toMatchObject({ location: "47798", category: "HAUSHALT" });
  });
});

describe("sanitizeAiQuery", () => {
  it("drops hallucinated locations and wages", () => {
    const q = sanitizeAiQuery({ location: "Düsseldorf", minHourlyCents: 2000, category: "GARTEN" }, "Gartenarbeit Krefeld");
    expect(q).toEqual({ category: "GARTEN" });
  });
  it("rejects invalid structures", () => {
    expect(sanitizeAiQuery({ category: "UNKNOWN" }, "x")).toBeNull();
  });
});

describe("fees", () => {
  it("splits 1,00 € gross into net and 19 % VAT", () => {
    expect(computeInvoiceAmounts(100, "REGULAR")).toMatchObject({ netCents: 84, taxCents: 16, grossCents: 100, taxRateBp: 1900 });
  });
  it("small business mode has no VAT", () => {
    expect(computeInvoiceAmounts(100, "KLEINUNTERNEHMER")).toMatchObject({ netCents: 100, taxCents: 0 });
  });
  it("formats invoice numbers", () => {
    expect(formatInvoiceNumber(2026, 42)).toBe("MMJ-2026-000042");
  });
});

describe("state machines", () => {
  it("listing transitions", () => {
    expect(nextListingStatus("DRAFT", "publish")).toBe("PUBLISHED");
    expect(nextListingStatus("PUBLISHED", "archive")).toBeNull();
    expect(nextListingStatus("CLOSED", "archive")).toBe("ARCHIVED");
  });
  it("application transitions respect the actor", () => {
    expect(canTransitionApplication("submitted", "accepted", "poster")).toBe(true);
    expect(canTransitionApplication("submitted", "accepted", "applicant")).toBe(false);
    expect(canTransitionApplication("rejected", "accepted", "poster")).toBe(false);
    expect(canTransitionApplication("viewed", "withdrawn", "applicant")).toBe(true);
  });
});

describe("validation", () => {
  const base = {
    posterType: "PRIVATE",
    title: "Hecke schneiden",
    description: "Wir suchen Hilfe beim Heckeschneiden im Garten, ca. 20 m.",
    category: "GARTEN",
    employmentType: "EINMALIG",
    city: "Krefeld",
    hoursTotal: 4,
    positions: 1,
    hourlyWageCents: 1500,
    paymentMethod: "BANK_TRANSFER",
  };
  it("accepts a valid listing", () => {
    expect(listingInputSchema.safeParse(base).success).toBe(true);
  });
  it("rejects cash payment notes", () => {
    expect(listingInputSchema.safeParse({ ...base, paymentNotes: "Zahlung bar vor Ort" }).success).toBe(false);
  });
  it("requires a location unless remote", () => {
    expect(listingInputSchema.safeParse({ ...base, city: null }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...base, city: null, remote: true }).success).toBe(true);
  });
  it("requires accepted terms on registration", () => {
    expect(registerSchema.safeParse({ email: "a@b.de", password: "sicheresPasswort1", username: "anna", acceptTerms: false }).success).toBe(false);
  });
});

describe("minimum wage table", () => {
  it("returns the value in effect", () => {
    expect(minimumWageCentsAt(new Date("2026-06-01"))).toBe(1390);
    expect(minimumWageCentsAt(new Date("2027-01-01"))).toBe(1460);
  });
});

describe("help", () => {
  it("finds the fee article", () => {
    expect(findHelpArticle("Was kostet die Gebühr?")?.slug).toBe("gebuehren");
  });
});
