import { expect, test, type Page } from "@playwright/test";
import { query } from "./db";

/**
 * Acceptance journey from the spec:
 * applicant registers, adds a qualification, finds an offer, applies (slider);
 * poster reviews and confirms; fee is booked exactly once in test mode.
 */
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const applicant = { email: `e2e-${stamp}@test.invalid`, username: `e2e_${stamp}`, password: "E2E-Passwort-2026" };
const poster = { email: "garten@myminijob.local", password: "Demo-Passwort-2026" };

async function login(page: Page, email: string, password: string) {
  await page.goto("/anmelden");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page).toHaveURL(/\/konto/);
}

test("1. Bewerber registriert sich und bestätigt die E-Mail", async ({ page }) => {
  await page.goto("/registrieren");
  await page.getByLabel("Benutzername").fill(applicant.username);
  await page.getByLabel("E-Mail").fill(applicant.email);
  await page.getByLabel("Passwort").fill(applicant.password);
  await page.getByText("Ich akzeptiere die").click();
  await page.getByRole("button", { name: "Kostenlos registrieren" }).click();
  await expect(page.getByRole("heading", { name: applicant.username })).toBeVisible();
  await expect(page.getByText("Bitte bestätige deine E-Mail-Adresse")).toBeVisible();
  const [mail] = await query<{ text: string }>(`SELECT text FROM "OutboxEmail" WHERE "to" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [applicant.email]);
  const link = mail!.text.match(/https?:\/\/\S+token=[\w-]+/)![0];
  await page.goto(new URL(link).pathname + new URL(link).search);
  await expect(page.getByText("E-Mail bestätigt")).toBeVisible();
});

test("2. Qualifikation per Autocomplete hinterlegen („Ele“)", async ({ page }) => {
  await login(page, applicant.email, applicant.password);
  await page.goto("/konto/lebenslauf");
  const combo = page.getByRole("combobox", { name: "Qualifikation suchen" });
  await combo.fill("Ele");
  await expect(page.getByRole("option").first()).toContainText(/Elektr/);
  await combo.fill("Elektroniker Ener");
  const option = page.getByRole("option", { name: /Elektroniker\/-in – Fachrichtung Energie- und Gebäudetechnik/ });
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.getByText("Selbstangabe, nicht geprüft").first()).toBeVisible();
  await page.getByLabel("Kurzprofil (Überschrift)").fill("Zuverlässig, gern draußen");
  await page.getByRole("button", { name: "Lebenslauf speichern" }).click();
  await expect(page.getByText("Lebenslauf gespeichert")).toBeVisible();
});

test("3. Angebot über KI-Suche finden und per Schieberegler bewerben", async ({ page }) => {
  await login(page, applicant.email, applicant.password);
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Suche in natürlicher Sprache" }).fill("Gartenarbeit ab 12,50 Euro Raum Krefeld");
  await page.getByRole("button", { name: "Suchen" }).click();
  await expect(page.getByRole("button", { name: "Filter Gartenarbeit entfernen" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Filter ab 12,50 €\/Std. entfernen/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Filter Krefeld \+ 25 km entfernen/ })).toBeVisible();
  await page.getByRole("link", { name: /Hecke schneiden und Grünschnitt entsorgen/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Hecke schneiden und Grünschnitt entsorgen" })).toBeVisible();
  await expect(page.getByText("1. Profil prüfen")).toBeVisible();
  await page.getByLabel("Nachricht an den Auftraggeber").fill("Ich habe am Samstag Zeit.");
  const thumb = page.getByTestId("slide-thumb");
  await page.getByRole("button", { name: "Ohne Schieben bewerben" }).scrollIntoViewIfNeeded();
  const box = (await thumb.boundingBox())!;
  const track = (await thumb.locator("..").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width - 10, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByText("Bewerbung gesendet")).toBeVisible();
  await expect(page.getByText("Du hast dich beworben")).toBeVisible();
  const rows = await query(`SELECT a.id FROM "Application" a JOIN "User" u ON u.id = a."applicantId" WHERE u.email = $1`, [applicant.email]);
  expect(rows).toHaveLength(1);
});

test("4. Auftraggeber prüft und sagt zahlungspflichtig zu", async ({ page }) => {
  await login(page, poster.email, poster.password);
  await page.goto("/konto/inserate");
  await page.getByRole("link", { name: /Hecke schneiden und Grünschnitt entsorgen/ }).click();
  await page.getByRole("button", { name: new RegExp(applicant.username) }).click();
  await expect(page.getByText("Elektroniker/-in – Fachrichtung Energie- und Gebäudetechnik")).toBeVisible();
  await page.getByRole("button", { name: "Zusagen …" }).click();
  const dialog = page.getByRole("dialog", { name: "Verbindlich zusagen" });
  await expect(dialog.getByText("1,00 € (einmalig)")).toBeVisible();
  const feeButton = dialog.getByRole("button", { name: "Zahlungspflichtig zusagen (1,00 €)" });
  await expect(feeButton).toBeDisabled();
  await dialog.getByText("Ich habe den Gebührenhinweis gelesen.").click();
  await feeButton.click();
  await expect(page.getByText(`Zusage an ${applicant.username} gesendet`)).toBeVisible();
  await expect(page.getByText("Wartet auf Bestätigung der Person")).toBeVisible();
  expect(await query(`SELECT id FROM "Invoice"`)).toHaveLength(0); // no fee before the applicant accepts
});

test("5. Bewerber nimmt an – Gebühr wird genau einmal verbucht (Testmodus)", async ({ page, browser }) => {
  await login(page, applicant.email, applicant.password);
  await page.goto("/konto/angebote");
  const accept = page.getByRole("button", { name: "Zusage annehmen" });
  // double click must not create two fee events
  await accept.dblclick();
  await expect(page.getByText("Vermittlung bestätigt")).toBeVisible();
  const inv = await query<{ number: string; grossCents: number; isTest: boolean; status: string }>(`SELECT number, "grossCents", "isTest", status FROM "Invoice"`);
  expect(inv).toHaveLength(1);
  expect(inv[0]).toMatchObject({ grossCents: 100, isTest: true, status: "OPEN" });

  const posterCtx = await browser.newContext();
  const p2 = await posterCtx.newPage();
  await login(p2, poster.email, poster.password);
  await p2.goto("/konto/rechnungen");
  await expect(p2.getByText("Testmodus")).toBeVisible();
  await p2.getByRole("link", { name: new RegExp(inv[0]!.number) }).click();
  await p2.getByRole("button", { name: "Testzahlung ausführen (kein echtes Geld)" }).click();
  await expect(p2.getByText("Testzahlung erfolgreich")).toBeVisible();
  const pay = await query<{ amountCents: number; isTest: boolean }>(`SELECT "amountCents", "isTest" FROM "Payment"`);
  expect(pay).toEqual([{ amountCents: 100, isTest: true }]);
  const pdf = await p2.request.get(`/api/v1/invoices/${(await query<{ id: string }>(`SELECT id FROM "Invoice"`))[0]!.id}/pdf`);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  await posterCtx.close();
});

test("6. Chat zwischen beiden Parteien", async ({ page, browser }) => {
  await login(page, applicant.email, applicant.password);
  await page.goto("/konto/nachrichten");
  await page.getByRole("link", { name: /Hecke schneiden/ }).click();
  await page.getByLabel("Nachricht", { exact: true }).fill("Bis Samstag!");
  await page.getByRole("button", { name: "Senden" }).click();
  await expect(page.getByText("Bis Samstag!")).toBeVisible();
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await login(p2, poster.email, poster.password);
  await p2.goto("/konto/nachrichten");
  await expect(p2.getByText("Bis Samstag!")).toBeVisible();
  await ctx.close();
});
