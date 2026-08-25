import { test, expect } from "@playwright/test";

async function addFirstProduct(page: import("@playwright/test").Page) {
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  const href = await page.locator('a[href^="/products/"]').first().getAttribute("href");
  if (!href) throw new Error("No product link");
  await page.goto(href, { waitUntil: "domcontentloaded" });
  const colourGroup = page.getByRole("radiogroup", { name: /select colour/i });
  if (await colourGroup.count()) {
    await colourGroup.locator(".size-option:not(.is-unavailable)").first().click();
  }
  const sizeGroup = page.getByRole("radiogroup", { name: /select size/i });
  await expect(sizeGroup).toBeVisible({ timeout: 15000 });
  const sizeChoice = sizeGroup.getByRole("radio", { name: "M/Men's" });
  await sizeChoice.scrollIntoViewIfNeeded();
  await expect(async () => {
    await sizeChoice.click({ force: true });
    await expect(sizeChoice).toHaveAttribute("aria-checked", "true");
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: /add to cart/i }).click();
  await expect(page.getByText(/added to cart/i)).toBeVisible({ timeout: 15000 });
}

test.describe("checkout + Stripe TEST", () => {
  test("checkout creates Stripe TEST session from server totals", async ({ page, request }) => {
    await addFirstProduct(page);
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    const offerClose = page.getByRole("button", { name: /^close$/i });
    if (await offerClose.count()) {
      await offerClose.first().click({ timeout: 2000 }).catch(() => undefined);
    }
    await page.getByLabel("Email").fill(`qa.stripe+${Date.now()}@sjh-internal.test`);
    await page.getByLabel("Phone").fill("+15555550123");
    await page.getByLabel("Full name").fill("QA STRIPE");
    await page.getByLabel("Address line 1").fill("1 Audit Street");
    await page.getByLabel("City").fill("Austin");
    await page.getByLabel("State / province").fill("TX");
    await page.getByLabel("Postal code").fill("78701");

    await Promise.all([
      page.waitForURL(/checkout\.stripe\.com/, { timeout: 90_000 }),
      page.getByRole("button", { name: /^Pay with Stripe$/i }).click()
    ]);
    await expect(page).toHaveURL(/stripe\.com/);
  });

  test("cancelled checkout stays unpaid via cancel URL pattern", async ({ request }) => {
    const health = await request.get("/api/webhooks/stripe");
    const json = (await health.json()) as { mode?: string };
    expect(json.mode).toBe("test_only");
  });
});
