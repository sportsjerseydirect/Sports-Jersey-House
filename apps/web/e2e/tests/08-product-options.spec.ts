import { test, expect } from "@playwright/test";

/**
 * Permanent regression: SJD-compatible product options
 * (colour ≠ size, size from option set, customisation Yes/No + fields).
 */
const SAMPLES = [
  {
    name: "NHL Default Title",
    slug: "nhl-connor-mcdavid-western-all-star-97-jersey",
    expectColourPicker: false
  },
  {
    name: "MLB colour variants",
    slug: "mlb-edouard-julien-minnesota-twins-47-jersey",
    expectColourPicker: true
  },
  {
    name: "Soccer",
    slug: "alexander-isak-newcastle-united-fc-14-jersey",
    expectColourPicker: true
  }
] as const;

test.describe("product options layer", () => {
  for (const sample of SAMPLES) {
    test(`${sample.name}: size is not colour / Default Title`, async ({ page }) => {
      const res = await page.goto(`/products/${sample.slug}`, { waitUntil: "domcontentloaded" });
      if (!res || res.status() >= 400) {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Size", exact: true })).toBeVisible();

      const sizeGroup = page.getByRole("radiogroup", { name: /select size/i });
      await expect(sizeGroup).toBeVisible();
      const sizeLabels = await sizeGroup.locator(".size-option").allTextContents();
      expect(sizeLabels.length).toBeGreaterThan(0);
      for (const label of sizeLabels) {
        expect(label.toLowerCase()).not.toBe("default title");
        expect(label.toLowerCase()).not.toBe("white");
        expect(label.toLowerCase()).not.toBe("cream");
      }

      if (sample.expectColourPicker) {
        await expect(page.getByRole("radiogroup", { name: /select colour/i })).toBeVisible();
      }

      await sizeGroup.locator(".size-option").first().click();
      await page.getByRole("radio", { name: /^Yes/i }).click();
      await page.getByLabel(/^Name$/i).fill("CHADHA");
      await page.getByLabel(/^Number$/i).fill("07");
      await page.getByLabel(/any message/i).fill("TEST");
      await page.getByRole("button", { name: /add to cart/i }).click();
      await expect(page.getByText(/added to cart/i)).toBeVisible({ timeout: 15000 });

      await page.goto("/cart", { waitUntil: "domcontentloaded" });
      await expect(page.getByText(/^Size:/i).first()).toBeVisible();
      await expect(page.getByText(/Customisation:\s*Yes/i).first()).toBeVisible();
      await expect(page.getByText(/Name:\s*CHADHA/i).first()).toBeVisible();
      await expect(page.getByText(/Number:\s*07/i).first()).toBeVisible();
      await expect(page.getByText(/Size:\s*Default Title/i)).toHaveCount(0);
      await expect(page.getByText(/Size:\s*White/i)).toHaveCount(0);
    });
  }
});
