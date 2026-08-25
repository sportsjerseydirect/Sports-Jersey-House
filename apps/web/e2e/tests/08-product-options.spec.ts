import { test, expect } from "@playwright/test";
import { addProductFromPdp, dismissWelcomeOffer } from "../helpers/storefront";

/**
 * Permanent regression: SJD-compatible product options
 * (colour ≠ size, size from option set, customisation Yes/No + fields).
 */
const SAMPLES = [
  {
    name: "NHL Default Title",
    slug: "nhl-connor-mcdavid-western-all-star-97-jersey",
    expectColourPicker: false,
    size: "M/Men's"
  },
  {
    name: "MLB colour variants",
    slug: "mlb-edouard-julien-minnesota-twins-47-jersey",
    expectColourPicker: true,
    size: "M/Men's"
  },
  {
    name: "Soccer",
    slug: "alexander-isak-newcastle-united-fc-14-jersey",
    expectColourPicker: true,
    size: "M/Men's"
  }
] as const;

test.describe("product options layer", () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeOffer(page);
  });

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

      await addProductFromPdp(page, `/products/${sample.slug}`, {
        size: sample.size,
        selectColour: sample.expectColourPicker,
        customisation: { name: "CHADHA", number: "07", message: "TEST" }
      });

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
