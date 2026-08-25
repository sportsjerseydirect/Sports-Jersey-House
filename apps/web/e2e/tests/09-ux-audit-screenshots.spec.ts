import { test } from "@playwright/test";
import path from "node:path";
import { dismissWelcomeOffer, SAMPLE_PRODUCTS } from "../helpers/storefront";

const OUT = path.join(process.cwd(), "../../docs/ux-audit-screenshots");

test.describe("UX audit screenshots", () => {
  test.beforeEach(async ({ page }) => {
    await dismissWelcomeOffer(page);
  });

  test("capture storefront journey", async ({ page }) => {
    test.setTimeout(120_000);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, "01-homepage-desktop.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, "02-homepage-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(SAMPLE_PRODUCTS.nhlDefaultTitle, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, "03-pdp-nhl-desktop.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(SAMPLE_PRODUCTS.nhlDefaultTitle, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, "04-pdp-nhl-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(SAMPLE_PRODUCTS.mlbColour, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, "05-pdp-mlb-desktop.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(SAMPLE_PRODUCTS.mlbColour, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, "06-pdp-mlb-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/search?q=NHL", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, "07-search-nhl-desktop.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/search?q=Everton", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, "08-search-everton-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(SAMPLE_PRODUCTS.soccer, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, "09-pdp-soccer-desktop.png"), fullPage: true });

    const { addProductFromPdp } = await import("../helpers/storefront");
    await page.setViewportSize({ width: 390, height: 844 });
    await addProductFromPdp(page, SAMPLE_PRODUCTS.soccer, {
      customisation: { name: "AUDIT", number: "10" }
    });
    await page.goto("/cart", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, "10-cart-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cart", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, "11-cart-desktop.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/checkout", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, "12-checkout-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/checkout", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, "13-checkout-desktop.png"), fullPage: true });
  });
});
