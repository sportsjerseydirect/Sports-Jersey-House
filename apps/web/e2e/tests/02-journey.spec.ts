import { test, expect } from "@playwright/test";
import { addProductFromPdp, dismissWelcomeOffer, SAMPLE_PRODUCTS } from "../helpers/storefront";

test.describe("discovery + PDP + cart", () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeOffer(page);
  });

  test("homepage, products, search, collection, PDP add to cart", async ({ page }) => {
    const home = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(home?.ok()).toBeTruthy();
    await expect(page.locator("header")).toBeVisible();

    await page.goto("/products", { waitUntil: "domcontentloaded" });
    await expect(page.locator('a[href^="/products/"]').first()).toBeVisible({ timeout: 20000 });

    await page.goto("/search?q=NHL", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible();

    await page.goto("/collections", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible();

    // Use a known product with Aris size option set (not first alphabetical — may lack sizes).
    await addProductFromPdp(page, SAMPLE_PRODUCTS.nhlDefaultTitle);

    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByText(/^Size:/i).first()).toBeVisible();
  });

  test("invalid options without size are rejected by API", async ({ request }) => {
    const products = await request.get("/products");
    expect(products.ok()).toBeTruthy();
    const html = await products.text();
    const match = html.match(/href="(\/products\/[^"]+)"/);
    expect(match?.[1]).toBeTruthy();
    const pdp = await request.get(match![1]!);
    const pdpHtml = await pdp.text();
    const variant = pdpHtml.match(/"id":"([0-9a-f-]{36})"/);
    if (!variant) {
      test.skip();
      return;
    }
    const res = await request.post("/api/cart/items", {
      data: {
        variantId: variant[1],
        quantity: 1,
        selectedOptions: {
          size: "NOT-A-REAL-SIZE",
          customisation: { enabled: false }
        }
      }
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("WELCOME10 eligibility is server-side", async ({ request }) => {
    const ineligible = await request.get("/api/offers/welcome10?email=qa-ineligible@example.com");
    expect(ineligible.ok()).toBeTruthy();
    const body = (await ineligible.json()) as { eligible?: boolean };
    expect(body.eligible).toBeFalsy();
  });
});
