import { test, expect } from "@playwright/test";

test.describe("discovery + PDP + cart", () => {
  test("homepage, products, search, collection, PDP add to cart", async ({ page }) => {
    const home = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(home?.ok()).toBeTruthy();
    await expect(page.locator("header")).toBeVisible();

    await page.goto("/products", { waitUntil: "domcontentloaded" });
    const productLink = page.locator('a[href^="/products/"]').first();
    await expect(productLink).toBeVisible({ timeout: 20000 });
    const href = await productLink.getAttribute("href");
    expect(href).toBeTruthy();

    await page.goto(href!, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/made to order/i).first()).toBeVisible();

    const colourGroup = page.getByRole("radiogroup", { name: /select colour/i });
    if (await colourGroup.count()) {
      await colourGroup.getByRole("radio").first().click({ force: true });
    }

    const sizeGroup = page.getByRole("radiogroup", { name: /select size/i });
    await expect(sizeGroup).toBeVisible({ timeout: 15000 });
    const sizeChoice = sizeGroup.getByRole("radio", { name: "M/Men's" });
    await sizeChoice.scrollIntoViewIfNeeded();
    await expect(async () => {
      await sizeChoice.click({ force: true });
      await expect(sizeChoice).toHaveAttribute("aria-checked", "true");
    }).toPass({ timeout: 15_000 });

    const add = page.getByRole("button", { name: /add to cart/i });
    await expect(add).toBeVisible();
    await add.click();
    await expect(page.getByText(/added to cart/i)).toBeVisible({ timeout: 15000 });

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
