/**
 * Text normalisation shared by catalog import, autocomplete and search.
 * Must stay in sync with the SQL function `mm_normalize()` in the migrations.
 */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\/-?in\b|\/-?innen\b|\(in\)|\*in\b|:in\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Escapes user input for safe use in ILIKE patterns. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export function slugify(input: string): string {
  return normalizeText(input).replace(/\s/g, "-").slice(0, 80);
}
