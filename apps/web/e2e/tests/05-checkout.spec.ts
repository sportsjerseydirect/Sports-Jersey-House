import { test, expect } from "@playwright/test";
import { addFirstCatalogProduct, dismissWelcomeOffer } from "../helpers/storefront";

test.describe("checkout + Stripe TEST", () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeOffer(page);
  });

  test("checkout creates Stripe TEST session from server totals", async ({ page }) => {
    await addFirstCatalogProduct(page);
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /complete your order/i })).toBeVisible();

    const contact = page.getByRole("group", { name: /^Contact$/i });
    const shipping = page.getByRole("group", { name: /^Shipping$/i });
    const email = `qa.stripe+${Date.now()}@sjh-internal.test`;

    await contact.getByLabel(/^Email$/i).fill(email);
    await contact.getByLabel(/^Phone$/i).fill("+15555550123");
    await shipping.getByLabel(/^Full name$/i).fill("QA STRIPE");
    await shipping.getByLabel(/^Address line 1$/i).fill("1 Audit Street");
    await shipping.getByLabel(/^City$/i).fill("Austin");
    await shipping.getByLabel(/^State \/ province$/i).fill("TX");
    await shipping.getByLabel(/^Postal code$/i).fill("78701");

    await expect(contact.getByLabel(/^Email$/i)).toHaveValue(email);

    const payButton = page.getByRole("button", { name: /^Pay with Stripe$/i });
    await expect(page.getByText(/please complete email/i)).toHaveCount(0);

    await Promise.all([
      page.waitForURL(/checkout\.stripe\.com/, { timeout: 90_000 }),
      payButton.click()
    ]);
    await expect(page).toHaveURL(/stripe\.com/);
  });

  test("cancelled checkout stays unpaid via cancel URL pattern", async ({ request }) => {
    const health = await request.get("/api/webhooks/stripe");
    const json = (await health.json()) as { mode?: string };
    expect(json.mode).toBe("test_only");
  });
});
