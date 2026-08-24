import { test, expect } from "@playwright/test";

test.describe("SEO basics", () => {
  test("robots disallows admin/cart/checkout/supplier/orders", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toMatch(/Disallow:\s*\/admin/i);
    expect(text).toMatch(/Disallow:\s*\/cart/i);
    expect(text).toMatch(/Disallow:\s*\/checkout/i);
    expect(text).toMatch(/Disallow:\s*\/supplier/i);
    expect(text).toMatch(/Disallow:\s*\/orders/i);
  });

  test("sitemap includes products and collections", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok()).toBeTruthy();
    const xml = await res.text();
    expect(xml).toContain("/products/");
    expect(xml).toContain("/collections/");
    expect(xml).not.toContain("/admin/");
  });

  test("published PDP has canonical, title, json-ld", async ({ page }) => {
    await page.goto("/products", { waitUntil: "domcontentloaded" });
    const href = await page.locator('a[href^="/products/"]').first().getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto(href!, { waitUntil: "domcontentloaded" });
    const title = await page.title();
    expect(title.length).toBeGreaterThan(8);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toContain("/products/");
    const jsonLd = await page.locator('script[type="application/ld+json"]').count();
    expect(jsonLd).toBeGreaterThan(0);
    const robotsMeta = page.locator('meta[name="robots"]');
    if ((await robotsMeta.count()) > 0) {
      const robots = await robotsMeta.getAttribute("content");
      expect(robots ?? "").not.toMatch(/noindex/i);
    }
  });

  test("unknown product is 404", async ({ request }) => {
    const res = await request.get("/products/this-product-does-not-exist-sjh-qa-404");
    expect(res.status()).toBe(404);
  });
});
