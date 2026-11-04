/**
 * Help centre articles. Used by the help pages and by the AI tool `getHelpArticle`.
 * Legal topics are general information only — not legal advice.
 */
export interface HelpArticle {
  slug: string;
  title: string;
  keywords: string[];
  body: string;
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "gebuehren",
    title: "Was kostet My Minijob?",
    keywords: ["gebühr", "kosten", "preis", "1 euro", "vermittlungsgebühr", "bezahlen", "rechnung"],
    body:
      "Bewerben ist kostenlos. Inserate einzustellen ist kostenlos. Erst wenn du als Inseratsteller einer Person verbindlich zusagst UND diese Person die Zusage annimmt, entsteht eine Vermittlungsgebühr von 1,00 € pro vermittelter Person. " +
      "Lehnt die Person ab oder antwortet nicht innerhalb von 7 Tagen, entsteht keine Gebühr. Für jede Gebühr erhältst du eine Rechnung unter „Mein Konto › Rechnungen“. " +
      "Die Arbeitsvergütung vereinbart und zahlt ihr direkt untereinander – My Minijob zahlt keine Löhne aus und verwaltet keine Lohnzahlungen.",
  },
  {
    slug: "bewerben",
    title: "Wie bewerbe ich mich?",
    keywords: ["bewerben", "bewerbung", "schieben", "lebenslauf", "zurückziehen"],
    body:
      "Lege einmal deinen Lebenslauf unter „Mein Konto › Lebenslauf“ an. Öffne dann ein Inserat, prüfe dein Profil, wähle optional Unterlagen aus und schiebe den Regler „Zum Bewerben schieben“ – oder nutze den Button „Jetzt bewerben“. " +
      "Du kannst dich auf jedes Inserat einmal bewerben. Solange keine Zusage vorliegt, kannst du die Bewerbung zurückziehen.",
  },
  {
    slug: "zusage",
    title: "Zusage erhalten – was nun?",
    keywords: ["zusage", "angebot", "annehmen", "ablehnen", "angenommen"],
    body:
      "Wenn dir ein Auftraggeber zusagt, findest du das unter „Mein Konto › Angenommene Angebote“. Du hast 7 Tage Zeit, die Zusage anzunehmen oder abzulehnen. Für dich als Bewerber ist das immer kostenlos.",
  },
  {
    slug: "inserat-erstellen",
    title: "Wie erstelle ich ein Inserat?",
    keywords: ["inserat", "anzeige", "erstellen", "veröffentlichen", "pausieren", "schließen", "stundenlohn"],
    body:
      "Unter „Mein Konto › Eigene Inserate“ startest du den Assistenten. Wähle Privat oder Gewerblich, beschreibe die Tätigkeit und gib einen verbindlichen Stundenlohn an. Barzahlung ist keine auswählbare Option. " +
      "Du kannst Entwürfe speichern, eine Vorschau ansehen, veröffentlichen, pausieren, schließen und archivieren. Bitte beachte den gesetzlichen Mindestlohn, sofern er für dein Beschäftigungsverhältnis gilt.",
  },
  {
    slug: "mindestlohn",
    title: "Mindestlohn und Minijob – allgemeine Informationen",
    keywords: ["mindestlohn", "minijob", "verdienstgrenze", "geringfügig", "recht", "steuer"],
    body:
      "Allgemeine Information, keine Rechtsberatung: Der gesetzliche Mindestlohn beträgt seit 1. Januar 2026 13,90 € brutto je Stunde und steigt laut Mindestlohnverordnung zum 1. Januar 2027 auf 14,60 €. " +
      "Für Arbeitnehmer gilt er grundsätzlich; Ausnahmen gibt es z. B. für Minderjährige ohne Berufsabschluss, Pflichtpraktika oder echte Selbstständigkeit. " +
      "„Minijob“ ist eine bestimmte sozialversicherungsrechtliche Beschäftigungsform mit Verdienstgrenze – nicht jeder Auftrag auf My Minijob ist ein Minijob im rechtlichen Sinn. Bitte prüfe deinen Einzelfall z. B. bei der Minijob-Zentrale oder einer Beratungsstelle.",
  },
  {
    slug: "qualifikationen",
    title: "Qualifikationen und Nachweise",
    keywords: ["qualifikation", "ausbildung", "studium", "meister", "zertifikat", "nachweis", "geprüft"],
    body:
      "Qualifikationen wählst du aus einem einheitlichen Katalog. Ohne Prüfung werden sie als „Selbstangabe“ angezeigt. Ein Nachweis (PDF) kann hochgeladen werden; erst nach Prüfung durch My Minijob erscheint „geprüft“.",
  },
  {
    slug: "datenschutz",
    title: "Meine Daten, Sichtbarkeit, Export und Löschung",
    keywords: ["datenschutz", "dsgvo", "sichtbarkeit", "löschen", "export", "daten"],
    body:
      "Du bestimmst pro Angabe, ob sie öffentlich, nur bei Bewerbungen oder nur für dich sichtbar ist. Foto und Geburtsdatum sind nie Pflicht. Unter „Einstellungen“ kannst du deine Daten exportieren und dein Konto löschen.",
  },
  {
    slug: "sicherheit",
    title: "Sicher bleiben: Betrug erkennen",
    keywords: ["betrug", "sicherheit", "melden", "blockieren", "vorkasse", "spam"],
    body:
      "Zahle niemals Vorkasse für einen Job. Teile keine Bankdaten oder Ausweiskopien im Chat, bevor du dein Gegenüber geprüft hast. Verdächtige Inserate, Nachrichten oder Personen kannst du melden und blockieren.",
  },
];

export function findHelpArticle(query: string): HelpArticle | null {
  const q = query.toLowerCase();
  const bySlug = HELP_ARTICLES.find((a) => a.slug === q);
  if (bySlug) return bySlug;
  let best: { a: HelpArticle; score: number } | null = null;
  for (const a of HELP_ARTICLES) {
    const score = a.keywords.reduce((s, k) => (q.includes(k) ? s + k.length : s), 0) + (q.includes(a.title.toLowerCase()) ? 5 : 0);
    if (score > 0 && (!best || score > best.score)) best = { a, score };
  }
  return best?.a ?? null;
}
