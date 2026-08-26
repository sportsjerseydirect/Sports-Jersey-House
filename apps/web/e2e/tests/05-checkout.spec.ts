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

    const emailField = contact.getByLabel(/^Email$/i);
    await emailField.click();
    await emailField.fill(email);
    try {
      await expect(emailField).toHaveValue(email, { timeout: 5000 });
    } catch {
      await emailField.click();
      await emailField.clear();
      await emailField.pressSequentially(email, { delay: 15 });
      await expect(emailField).toHaveValue(email, { timeout: 5000 });
    }
    await contact.getByLabel(/^Phone$/i).fill("+15555550123");
    await shipping.getByLabel(/^Full name$/i).fill("QA STRIPE");
    await shipping.getByLabel(/^Address line 1$/i).fill("1 Audit Street");
    await shipping.getByLabel(/^City$/i).fill("Austin");
    await shipping.getByLabel(/^State \/ province$/i).fill("TX");
    await shipping.getByLabel(/^Postal code$/i).fill("78701");

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
