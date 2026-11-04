import { expect, test } from "@playwright/test";

test("Mobile: schwebende Bottom-Navigation mit genau zwei Tabs und Safe-Area", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Hauptnavigation" }).filter({ has: page.getByRole("link", { name: "Discover" }) }).last();
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link")).toHaveCount(2);
  await expect(nav.getByRole("link", { name: "Discover" })).toHaveAttribute("aria-current", "page");
  const pb = await nav.evaluate((el) => getComputedStyle(el).paddingBottom);
  expect(parseFloat(pb)).toBeGreaterThanOrEqual(12);
  // Touch targets ≥ 44 px
  for (const link of await nav.getByRole("link").all()) {
    const b = (await link.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  // Chat bubble sits above the navigation
  const bubble = (await page.getByRole("button", { name: "My Minijob AI öffnen" }).boundingBox())!;
  const navBox = (await nav.boundingBox())!;
  expect(bubble.y + bubble.height).toBeLessThanOrEqual(navBox.y + 8);
  await nav.getByRole("link", { name: "Mein Konto" }).click();
  await expect(page).toHaveURL(/anmelden/);
});
