import { z } from "zod";
import { EMPLOYMENT_TYPES, LISTING_CATEGORIES, QUALIFICATION_KINDS, type EmploymentType, type ListingCategory } from "./domain";
import { parseEuroToCents } from "./money";
import { normalizeText } from "./normalize";

/**
 * Structured search query. This is the single contract between the natural-language
 * parser (rule-based or AI) and the database search. Validated server-side.
 */
export const searchQuerySchema = z.object({
  text: z.string().max(200).optional(),
  category: z.enum(LISTING_CATEGORIES).optional(),
  location: z.string().max(80).optional(),
  radiusKm: z.number().int().min(1).max(300).optional(),
  minHourlyCents: z.number().int().min(0).max(100000).optional(),
  employmentTypes: z.array(z.enum(EMPLOYMENT_TYPES)).max(9).optional(),
  weekend: z.boolean().optional(),
  evening: z.boolean().optional(),
  remote: z.boolean().optional(),
  qualificationTerms: z.array(z.string().max(80)).max(5).optional(),
  qualificationKind: z.enum(QUALIFICATION_KINDS).optional(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

/** JSON schema handed to the LLM so it returns the same structure. */
export const searchQueryJsonSchema = z.toJSONSchema(searchQuerySchema);

const CATEGORY_KEYWORDS: Array<[RegExp, ListingCategory]> = [
  [/\b(garten\w*|rasen\w*|hecke\w*|unkraut|laub\w*|baumschnitt)\b/, "GARTEN"],
  [/\b(haushalt\w*|putz\w*|reinigung\w*|buegel\w*|fenster ?putzen|haushaltshilfe)\b/, "HAUSHALT"],
  [/\b(einkauf\w*|einkaufen|besorgung\w*)\b/, "EINKAUF"],
  [/\b(nachhilfe\w*|hausaufgaben\w*|lernhilfe)\b/, "NACHHILFE"],
  [/\b(event\w*|messe\w*|veranstaltung\w*|festival\w*|catering\w*)\b/, "EVENT"],
  [/\b(gastro\w*|kellner\w*|service ?kraft|bar ?keeper|kueche\w*|koch|spuel\w*|restaurant\w*)\b/, "GASTRONOMIE"],
  [/\b(buero\w*|verwaltung\w*|empfang\w*|datenerfassung|sekretariat)\b/, "BUERO"],
  [/\b(handwerk\w*|maler\w*|renovier\w*|montage\w*|tischler\w*|schreiner\w*|fliesen\w*)\b/, "HANDWERK"],
  [/\b(betreuung\w*|babysitt\w*|kinderbetreuung|senioren\w*|hundesitt\w*|gassi\w*)\b/, "BETREUUNG"],
  [/\b(umzug\w*|lager\w*|logistik\w*|kurier\w*|ausliefer\w*|transport\w*)\b/, "LOGISTIK"],
  [/\b(it|computer\w*|pc ?hilfe|technik ?hilfe|webseite\w*|programmier\w*)\b/, "IT"],
];

const EMPLOYMENT_KEYWORDS: Array<[RegExp, EmploymentType]> = [
  [/\b(minijob\w*|450 ?euro|520 ?euro|556 ?euro|603 ?euro)\b/, "MINIJOB"],
  [/\bteilzeit\w*\b/, "TEILZEIT"],
  [/\bvollzeit\w*\b/, "VOLLZEIT"],
  [/\bbefristet\w*\b/, "BEFRISTET"],
  [/\b(einmalig\w*|einmal ?job)\b/, "EINMALIG"],
  [/\bprojekt\w*\b/, "PROJEKT"],
  [/\b(ausbildung\w*|azubi\w*|lehrstelle\w*)\b/, "AUSBILDUNG"],
  [/\bpraktik\w*\b/, "PRAKTIKUM"],
  [/\bwerkstudent\w*\b/, "WERKSTUDENT"],
];

const STOPWORDS = new Set(
  "ich suche suchen such finde finden einen eine ein der die das den dem fuer mit und oder als nach von pro je im in bei am an um ab bis job jobs stelle stellen arbeit angebot angebote mindestens mind min euro eur stunde stunden std h raum naehe nahe umgebung umkreis region km kilometer gerne bitte irgendwo deutschlandweit ganz".split(
    " ",
  ),
);

export interface ParseOptions {
  /** Returns true if a (normalised) token is a known German place name or postal code. */
  isKnownPlace?: (normalizedToken: string) => boolean;
}

export interface ParsedSearch {
  query: SearchQuery;
  /** Human readable chips, e.g. "ab 12,50 €/h". */
  chips: Array<{ key: keyof SearchQuery; label: string }>;
  parser: "rules" | "ai";
}

/**
 * Deterministic German natural-language parser. Always available (also when the AI is down).
 * Never invents values: every extracted field must be backed by text in the input.
 */
export function parseSearchRules(input: string, opts: ParseOptions = {}): SearchQuery {
  const original = input.slice(0, 300);
  let rest = ` ${original} `;
  const q: SearchQuery = {};
  const consume = (re: RegExp) => {
    rest = rest.replace(re, " ");
  };

  // --- wage: "ab 12,50 Euro", "mindestens 15 €", "min. 14 Euro/h", "15€ pro Stunde", "über 13 Euro"
  const wageRe = /(?:\b(?:ab|mind(?:estens|\.)?|min\.?|ueber|über|von)\s*)?(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:€|euro\b|eur\b)(?:\s*(?:\/|pro|je|die)\s*(?:std\.?|stunde|h)\b)?/i;
  const wage = original.match(wageRe);
  if (wage?.[1]) {
    const cents = parseEuroToCents(wage[1]);
    if (cents !== null && cents > 0) q.minHourlyCents = cents;
    consume(wageRe);
  }

  // --- radius: "im Umkreis von 20 km", "20 km", "20km um"
  const radiusRe = /(?:\b(?:im\s+)?umkreis\s+(?:von\s+)?)?(\d{1,3})\s*(?:km|kilometer)\b(?:\s+(?:um|von)\b)?/i;
  const radius = rest.match(radiusRe);
  if (radius?.[1]) {
    q.radiusKm = Math.min(300, Math.max(1, Number(radius[1])));
    consume(radiusRe);
  }

  // --- location after a preposition: "Raum Krefeld", "in Dortmund", "bei 47798", "nähe Köln-Ehrenfeld"
  const locRe = /(?:^|\s)(?:raum|in|bei|nähe|naehe|nahe|um|region|umgebung)\s+((?:\d{5})|(?:[A-ZÄÖÜ][\wäöüß.-]+(?:\s+(?:am|an der|im|ob der)\s+[A-ZÄÖÜ][\wäöüß.-]+)?))/giu;
  const isKeyword = (word: string) => {
    const n = normalizeText(word);
    return (
      STOPWORDS.has(n) ||
      CATEGORY_KEYWORDS.some(([re]) => re.test(n)) ||
      EMPLOYMENT_KEYWORDS.some(([re]) => re.test(n)) ||
      /^(wochenend\w*|vollzeit|teilzeit|remote|homeoffice)$/.test(n)
    );
  };
  const loc = [...rest.matchAll(locRe)].find((m) => m[1] && /^(\d{5}|[A-ZÄÖÜ])/u.test(m[1]) && !isKeyword(m[1]));
  if (loc?.[1]) {
    q.location = loc[1].trim();
    if (/\b(raum|umgebung|region|nähe|naehe|nahe)\b/i.test(loc[0]) && q.radiusKm === undefined) q.radiusKm = 25;
    rest = rest.replace(loc[0], " ");
  } else {
    const plz = rest.match(/\b\d{5}\b/);
    if (plz) {
      q.location = plz[0];
      rest = rest.replace(plz[0], " ");
    } else if (opts.isKnownPlace) {
      // standalone capitalised token that is a known place: "Wochenendjob Dortmund"
      const tokens = rest.match(/[A-ZÄÖÜ][\wäöüß-]{2,}/gu) ?? [];
      for (const t of tokens) {
        if (opts.isKnownPlace(normalizeText(t))) {
          q.location = t;
          rest = rest.replace(t, " ");
          break;
        }
      }
    }
  }

  const norm = normalizeText(rest);
  const normAll = normalizeText(original);

  // --- schedule
  if (/\b(wochenend\w*|samstag\w*|sonntag\w*|sa so)\b/.test(normAll)) q.weekend = true;
  if (/\b(abends?|abendjob\w*|nachmittags? und abends)\b/.test(normAll)) q.evening = true;
  if (/\b(remote|homeoffice|home office|von zuhause|von zu hause)\b/.test(normAll)) q.remote = true;

  // --- category & employment
  for (const [re, cat] of CATEGORY_KEYWORDS) {
    if (re.test(norm)) {
      q.category = cat;
      break;
    }
  }
  const types = new Set<EmploymentType>();
  for (const [re, t] of EMPLOYMENT_KEYWORDS) if (re.test(normAll)) types.add(t);
  if (types.size) q.employmentTypes = [...types];
  if (/\b(studium|studienfach|studierte?|akademik\w*)\b/.test(normAll)) q.qualificationKind = "STUDIENFACH";
  if (/\b(meister\w*)\b/.test(normAll)) q.qualificationKind = "MEISTER_FORTBILDUNG";

  // --- residual free text (stopwords and "-job" suffixes removed)
  const residual = norm
    .split(" ")
    .map((w) => w.replace(/(job|jobs)$/, ""))
    .filter((w) => w.length > 1 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
    // words already turned into structured filters are not repeated as free text
    .filter(
      (w) =>
        !CATEGORY_KEYWORDS.some(([re]) => re.test(w)) &&
        !EMPLOYMENT_KEYWORDS.some(([re]) => re.test(w)) &&
        !/^(wochenend\w*|samstag\w*|sonntag\w*|abends?|abendjob|remote|homeoffice|studium|meister\w*)$/.test(w),
    );
  if (residual.length) q.text = residual.join(" ").slice(0, 200);

  return searchQuerySchema.parse(q);
}

/**
 * Validates an AI parser result against the original input so the model cannot
 * hallucinate places or wages that the user never typed.
 */
export function sanitizeAiQuery(candidate: unknown, input: string): SearchQuery | null {
  const parsed = searchQuerySchema.safeParse(candidate);
  if (!parsed.success) return null;
  const q = { ...parsed.data };
  const normInput = normalizeText(input);
  if (q.location && !normInput.includes(normalizeText(q.location))) delete q.location;
  if (q.minHourlyCents !== undefined) {
    const euros = String(Math.floor(q.minHourlyCents / 100));
    if (!input.includes(euros)) delete q.minHourlyCents;
  }
  if (q.radiusKm !== undefined && !input.includes(String(q.radiusKm)) && !/\b(raum|umgebung|nähe|naehe|region)\b/i.test(input)) {
    delete q.radiusKm;
  }
  return q;
}

export function describeQuery(q: SearchQuery, labels: { category?: string; employment?: (t: EmploymentType) => string } = {}) {
  const chips: ParsedSearch["chips"] = [];
  if (q.text) chips.push({ key: "text", label: `„${q.text}“` });
  if (q.category) chips.push({ key: "category", label: labels.category ?? q.category });
  if (q.location) chips.push({ key: "location", label: q.radiusKm ? `${q.location} + ${q.radiusKm} km` : q.location });
  else if (q.radiusKm) chips.push({ key: "radiusKm", label: `${q.radiusKm} km` });
  if (q.minHourlyCents !== undefined)
    chips.push({ key: "minHourlyCents", label: `ab ${(q.minHourlyCents / 100).toFixed(2).replace(".", ",")} €/h` });
  for (const t of q.employmentTypes ?? []) chips.push({ key: "employmentTypes", label: labels.employment?.(t) ?? t });
  if (q.weekend) chips.push({ key: "weekend", label: "Wochenende" });
  if (q.evening) chips.push({ key: "evening", label: "Abends" });
  if (q.remote) chips.push({ key: "remote", label: "Remote" });
  if (q.qualificationKind) chips.push({ key: "qualificationKind", label: q.qualificationKind === "STUDIENFACH" ? "Studium" : "Meister/Fortbildung" });
  return chips;
}

/** Great-circle distance in km. Only used when BOTH sides have real coordinates. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
