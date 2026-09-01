import { test, expect } from "@playwright/test";

const LEAGUES = ["nfl", "nba", "nhl", "mlb", "soccer", "ncaa"] as const;

test.describe("collection audit", () => {
  for (const league of LEAGUES) {
    test(`collection /collections/${league} has published products`, async ({ page }) => {
      await page.goto(`/collections/${league}`, { waitUntil: "domcontentloaded" });
      const products = page.locator('a[href^="/products/"]');
      await expect(products.first()).toBeVisible({ timeout: 30_000 });
      const productCount = await products.count();
      console.log(JSON.stringify({ league, productCount, url: page.url() }));
      expect(productCount).toBeGreaterThan(0);
    });
  }
});
