/**
 * Seeds reference data (places, qualification catalog) and – only if SEED_DEMO=1 –
 * clearly marked demo accounts and demo listings for local development.
 * Idempotent: can be run repeatedly.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "@node-rs/argon2";
import { normalizeText } from "@myminijob/core";
import { getPrisma } from "../src/index";
import { PLACES, PLACES_VERSION } from "../data/places.seed";
import { importCatalog } from "./import-catalog";

const here = path.dirname(fileURLToPath(import.meta.url));
const prisma = getPrisma();

async function seedPlaces() {
  const count = await prisma.place.count();
  if (count >= PLACES.length) return console.log(`Orte: ${count} vorhanden.`);
  await prisma.place.deleteMany();
  await prisma.place.createMany({
    data: PLACES.map(([name, state, lat, lng, plz]) => ({ name, normalizedName: normalizeText(name), state, lat, lng, postalCode: plz || null })),
  });
  console.log(`Orte: ${PLACES.length} angelegt (${PLACES_VERSION}).`);
}

async function seedCatalog() {
  const csv = fs.readFileSync(path.join(here, "..", "data", "qualifications.dev-seed.csv"), "utf8");
  await importCatalog(prisma, {
    csv,
    version: "dev-seed-2026.11.1",
    source: "My Minijob Entwicklungs-Startkatalog (manuell kuratiert, vor Livebetrieb durch lizenzierte BIBB/BA-Daten ersetzen)",
    license: "Eigene Zusammenstellung – keine Übernahme geschützter Datenbankinhalte",
    notes: "Bezeichnungen orientieren sich an amtlichen Berufsbezeichnungen; vor Livebetrieb gegen offizielle Quelle prüfen.",
  });
}

async function upsertUser(email: string, username: string, roles: Array<"APPLICANT" | "PRIVATE_POSTER" | "BUSINESS_POSTER" | "ADMIN">, passwordHash: string, city?: string) {
  const place = city ? await prisma.place.findFirst({ where: { normalizedName: normalizeText(city) } }) : null;
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      emailVerifiedAt: new Date(),
      activeRole: roles.find((r) => r !== "ADMIN") ?? roles[0],
      isDemo: true,
      roles: { create: roles.map((type) => ({ type })) },
      profile: { create: { username, city, postalCode: place?.postalCode, lat: place?.lat, lng: place?.lng, visibility: {} } },
      resume: { create: {} },
    },
  });
  return user;
}

async function seedDemo() {
  const password = process.env.SEED_DEMO_PASSWORD ?? "Demo-Passwort-2026";
  const pw = await hash(password);
  const admin = await upsertUser("admin@myminijob.local", "admin", ["ADMIN", "APPLICANT"], pw, "Krefeld");
  const anna = await upsertUser("anna@myminijob.local", "anna_k", ["APPLICANT"], pw, "Krefeld");
  const privat = await upsertUser("garten@myminijob.local", "gartenfreund", ["APPLICANT", "PRIVATE_POSTER"], pw, "Krefeld");
  const firma = await upsertUser("firma@myminijob.local", "eventteam_rhein", ["BUSINESS_POSTER"], pw, "Düsseldorf");
  void admin;

  let business = await prisma.business.findFirst({ where: { ownerId: firma.id } });
  if (!business)
    business = await prisma.business.create({
      data: { ownerId: firma.id, name: "Eventteam Rhein GmbH (Demo)", legalForm: "GmbH", city: "Düsseldorf", postalCode: "40213", street: "Musterstraße 1", description: "Demo-Unternehmen für die lokale Entwicklung." },
    });

  if ((await prisma.listing.count({ where: { isDemo: true } })) > 0) return console.log("Demo-Inserate vorhanden.");

  const q = async (name: string) => (await prisma.qualification.findFirstOrThrow({ where: { normalizedName: normalizeText(name) } })).id;
  const geo = async (city: string) => {
    const p = await prisma.place.findFirst({ where: { normalizedName: normalizeText(city) } });
    return { city, postalCode: p?.postalCode ?? null, lat: p?.lat ?? null, lng: p?.lng ?? null };
  };
  const now = new Date();
  const listings = [
    { ownerId: privat.id, posterType: "PRIVATE" as const, title: "Hecke schneiden und Grünschnitt entsorgen", description: "Unsere Thujahecke (ca. 25 m, 1,80 m hoch) muss geschnitten werden. Werkzeug und Leiter sind vorhanden, Grünschnitt kommt in die Biotonne bzw. zum Wertstoffhof (Auto vorhanden).", category: "GARTEN" as const, employmentType: "EINMALIG" as const, ...(await geo("Krefeld")), hoursTotal: 6, positions: 2, hourlyWageCents: 1500, paymentMethod: "BANK_TRANSFER" as const, weekend: true },
    { ownerId: privat.id, posterType: "PRIVATE" as const, title: "Wöchentliche Einkaufshilfe für Seniorin", description: "Meine Mutter (82) braucht jeden Donnerstag Unterstützung beim Wocheneinkauf im Supermarkt um die Ecke. Etwa 2 Stunden pro Woche, freundlich und zuverlässig.", category: "EINKAUF" as const, employmentType: "MINIJOB" as const, ...(await geo("Krefeld")), hoursPerWeek: 2, positions: 1, hourlyWageCents: 1450, paymentMethod: "BANK_TRANSFER" as const },
    { ownerId: privat.id, posterType: "PRIVATE" as const, title: "Mathe-Nachhilfe 9. Klasse (Gymnasium)", description: "Unsere Tochter braucht Unterstützung in Mathematik (Funktionen, Gleichungssysteme). Zweimal pro Woche je 60 Minuten, gerne auch online.", category: "NACHHILFE" as const, employmentType: "BEFRISTET" as const, remote: true, ...(await geo("Krefeld")), hoursPerWeek: 2, positions: 1, hourlyWageCents: 2000, paymentMethod: "PAYPAL" as const },
    { ownerId: firma.id, businessId: business.id, posterType: "BUSINESS" as const, title: "Eventhelfer/-innen für Messeaufbau (Wochenende)", description: "Für den Auf- und Abbau eines Messestands suchen wir körperlich belastbare Helferinnen und Helfer. Einweisung vor Ort, Arbeitskleidung wird gestellt.", category: "EVENT" as const, employmentType: "BEFRISTET" as const, ...(await geo("Düsseldorf")), hoursTotal: 16, positions: 6, hourlyWageCents: 1600, paymentMethod: "BANK_TRANSFER" as const, weekend: true, requirements: [{ type: "ERFAHRUNG" as const, level: "PREFERRED" as const, text: "Erfahrung im Messebau" }] },
    { ownerId: firma.id, businessId: business.id, posterType: "BUSINESS" as const, title: "Servicekraft Catering (Minijob)", description: "Unterstützung bei Firmenevents und Hochzeiten im Raum Düsseldorf. Vor allem freitags und samstags abends.", category: "GASTRONOMIE" as const, employmentType: "MINIJOB" as const, ...(await geo("Düsseldorf")), hoursPerWeek: 8, positions: 3, hourlyWageCents: 1450, paymentMethod: "BANK_TRANSFER" as const, weekend: true, evening: true, requirements: [{ type: "ZERTIFIKAT" as const, level: "REQUIRED" as const, qualificationId: await q("Belehrung nach § 43 Infektionsschutzgesetz") }] },
    { ownerId: firma.id, businessId: business.id, posterType: "BUSINESS" as const, title: "Elektroniker/-in für Veranstaltungstechnik (Teilzeit)", description: "Wir suchen Unterstützung für Strom- und Lichtinstallationen bei Events. Ausbildung als Elektroniker/-in Energie- und Gebäudetechnik erforderlich.", category: "HANDWERK" as const, employmentType: "TEILZEIT" as const, ...(await geo("Düsseldorf")), hoursPerWeek: 20, positions: 1, hourlyWageCents: 2200, paymentMethod: "BANK_TRANSFER" as const, requirements: [{ type: "AUSBILDUNG" as const, level: "REQUIRED" as const, qualificationId: await q("Elektroniker/-in – Fachrichtung Energie- und Gebäudetechnik") }, { type: "FUEHRERSCHEIN" as const, level: "PREFERRED" as const, qualificationId: await q("Führerschein Klasse B") }] },
    { ownerId: firma.id, businessId: business.id, posterType: "BUSINESS" as const, title: "Ausbildung Veranstaltungskaufmann/-frau 2027", description: "Starte deine Ausbildung bei uns zum 1. August 2027. Du lernst Planung, Kalkulation und Durchführung von Veranstaltungen.", category: "BUERO" as const, employmentType: "AUSBILDUNG" as const, ...(await geo("Düsseldorf")), hoursPerWeek: 39, positions: 2, hourlyWageCents: 700, compensationNotes: "Ausbildungsvergütung gemäß Tarif bzw. gesetzlicher Mindestausbildungsvergütung; Stundensatz rechnerisch angegeben.", paymentMethod: "BANK_TRANSFER" as const, startDate: new Date("2027-08-01") },
    { ownerId: privat.id, posterType: "PRIVATE" as const, title: "Umzugshilfe in Dortmund (Samstag)", description: "Umzug einer 2-Zimmer-Wohnung vom 3. OG (ohne Aufzug) in eine Wohnung im EG. Transporter ist gemietet, wir brauchen zwei kräftige Hände.", category: "LOGISTIK" as const, employmentType: "EINMALIG" as const, ...(await geo("Dortmund")), hoursTotal: 5, positions: 2, hourlyWageCents: 1700, paymentMethod: "PAYPAL" as const, weekend: true },
  ];
  for (const { requirements, ...l } of listings as Array<(typeof listings)[number] & { requirements?: Array<{ type: "AUSBILDUNG" | "ERFAHRUNG" | "ZERTIFIKAT" | "FUEHRERSCHEIN"; level: "REQUIRED" | "PREFERRED"; text?: string; qualificationId?: string }> }>) {
    await prisma.listing.create({
      data: { ...l, status: "PUBLISHED", publishedAt: now, isDemo: true, requirements: requirements ? { create: requirements } : undefined },
    });
  }
  const resume = await prisma.resume.findUniqueOrThrow({ where: { userId: anna.id } });
  await prisma.resume.update({
    where: { id: resume.id },
    data: { headline: "Studentin, zuverlässig und gern draußen", summary: "Ich studiere BWL und suche flexible Jobs am Wochenende.", experience: [{ title: "Aushilfe Gartenpflege", organization: "Privat", from: "2024-04", to: "2025-10", description: "Rasenmähen, Heckenschnitt" }], education: [{ title: "Betriebswirtschaftslehre (B.Sc.)", institution: "Hochschule Niederrhein", from: "2024-10", to: null, qualificationId: await q("Betriebswirtschaftslehre") }] },
  });
  await prisma.resumeQualification.upsert({
    where: { resumeId_qualificationId: { resumeId: resume.id, qualificationId: await q("Führerschein Klasse B") } },
    create: { resumeId: resume.id, qualificationId: await q("Führerschein Klasse B") },
    update: {},
  });
  console.log(`Demo: 4 Konten (Passwort: ${password}) und ${listings.length} Demo-Inserate angelegt.`);
}

async function main() {
  await seedPlaces();
  await seedCatalog();
  if (process.env.SEED_DEMO === "1") await seedDemo();
  else console.log("Demo-Daten übersprungen (SEED_DEMO=1 setzen, um sie anzulegen).");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
