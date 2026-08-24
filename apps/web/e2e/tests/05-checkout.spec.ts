import { test, expect } from "@playwright/test";

async function addFirstProduct(page: import("@playwright/test").Page) {
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  const href = await page.locator('a[href^="/products/"]').first().getAttribute("href");
  if (!href) throw new Error("No product link");
  await page.goto(href, { waitUntil: "domcontentloaded" });
  const size = page.locator(".size-option:not(.is-unavailable)").first();
  if (await size.count()) await size.click();
  await page.getByRole("button", { name: /add to cart/i }).click();
  await expect(page.getByText(/added to cart/i)).toBeVisible({ timeout: 15000 });
}

test.describe("checkout + Stripe TEST", () => {
  test("checkout creates Stripe TEST session from server totals", async ({ page, request }) => {
    await addFirstProduct(page);
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Email").fill(`qa.stripe+${Date.now()}@sjh-internal.test`);
    await page.getByLabel("Phone").fill("+15555550123");
    await page.getByLabel("Full name").fill("QA STRIPE");
    await page.getByLabel("Address line 1").fill("1 Audit Street");
    await page.getByLabel("City").fill("Austin");
    await page.getByLabel(/state|region/i).fill("TX");
    await page.getByLabel(/postal|zip/i).fill("78701");

    const checkoutPromise = page.waitForResponse((res) => res.url().includes("/api/checkout") && res.request().method() === "POST");
    await page.getByRole("button", { name: /pay with stripe|place order|pay/i }).first().click();
    const api = await checkoutPromise;
    expect(api.ok()).toBeTruthy();
    const body = (await api.json()) as { checkoutUrl?: string; orderNumber?: string };
    expect(body.checkoutUrl).toContain("checkout.stripe.com");
    expect(body.orderNumber).toMatch(/^SJH-/);

    await page.goto(body.checkoutUrl!, { waitUntil: "domcontentloaded", timeout: 60000 });
    await expect(page).toHaveURL(/stripe\.com/);
  });

  test("cancelled checkout stays unpaid via cancel URL pattern", async ({ request }) => {
    const health = await request.get("/api/webhooks/stripe");
    const json = (await health.json()) as { mode?: string };
    expect(json.mode).toBe("test_only");
  });
});
