import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { query } from "./db";

const pages = ["/", "/suche?q=Garten", "/anmelden", "/registrieren", "/hilfe", "/rechtliches/gebuehren"];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`Barrierefreiheit (${scheme})`, () => {
    test.use({ colorScheme: scheme });
    for (const path of pages) {
      test(`keine WCAG-2.2-AA-Verstöße auf ${path}`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
      });
    }
    test("Inseratsdetail ohne Verstöße", async ({ page }) => {
      const [l] = await query<{ id: string }>(`SELECT id FROM "Listing" WHERE status='PUBLISHED' LIMIT 1`);
      await page.goto(`/inserate/${l!.id}`);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(r.violations.map((v) => v.id)).toEqual([]);
    });
  });
}

test("Dark Mode übernimmt die Farb-Tokens", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--c-bg").trim());
  expect(bg.toLowerCase()).toBe("#101722");
});

test("Tastatur: Skip-Link und sichtbarer Fokus", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Zum Inhalt springen" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  const outline = await page.evaluate(() => {
    const el = document.querySelector("a[href='/suche']") as HTMLElement;
    el.focus();
    return getComputedStyle(el).outlineStyle;
  });
  expect(outline).not.toBe("none");
});

test("Reduzierte Bewegung: Animationen werden verkürzt", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const dur = await page.evaluate(() => getComputedStyle(document.querySelector("a")!).transitionDuration);
  expect(parseFloat(dur)).toBeLessThan(0.01);
});

test("Intro: überspringbar und Folgebesuch ohne Intro", async ({ page }) => {
  await page.goto("/?intro=1");
  await expect(page.getByRole("dialog", { name: "My Minijob" })).toBeVisible();
  await expect(page.getByText("Menschen verbinden. Möglichkeiten schaffen.")).toBeVisible();
  await page.getByRole("button", { name: "My Minijob entdecken" }).click();
  await expect(page.getByRole("dialog", { name: "My Minijob" })).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("mmj_intro_seen_v1"))).toBe("1");
});

test("KI-Assistent im Basismodus antwortet mit echten Inseraten", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "My Minijob AI öffnen" }).click();
  const panel = page.getByRole("dialog", { name: "My Minijob AI" });
  await panel.getByLabel("Nachricht an den Assistenten").fill("Umzugshilfe Dortmund");
  await panel.getByRole("button", { name: "Senden" }).click();
  await expect(panel.getByText(/Basismodus ohne KI/)).toBeVisible();
  await expect(panel.getByRole("link", { name: /Umzugshilfe in Dortmund/ })).toBeVisible();
});
