/**
 * One-off customer journey audit — captures findings to test-results/customer-journey-audit.json
 * Does NOT modify production. Run: npx playwright test e2e/tests/10-customer-journey-audit.spec.ts
 */
import { test, expect, type Page } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { dismissWelcomeOffer, SAMPLE_PRODUCTS } from "../helpers/storefront";

type Severity = "P0" | "P1" | "P2" | "P3";
type Finding = {
  id: string;
  severity: Severity;
  journey: string;
  url: string;
  problem: string;
  evidence: string;
  recommendedFix: string;
};

const OUT_DIR = join(process.cwd(), "e2e/test-results");
const SCREENSHOT_DIR = join(process.cwd(), "../../docs/ux-audit-screenshots");

const SPORT_PRODUCTS = [
  { sport: "NFL", slug: "nfl-aaron-rodgers-new-york-jets-8-jersey" },
  { sport: "NBA", slug: "nba-aaron-holiday-indiana-pacers-4-jersey" },
  { sport: "MLB", slug: "mlb-aaron-bummer-chicago-white-sox-39-jersey" },
  { sport: "NHL", slug: "nhl-aaron-ekblad-florida-panthers-5-jersey" },
  { sport: "Soccer", slug: "aaron-cresswell-west-ham-3-jersey" },
  { sport: "NCAA basketball", slug: "1-army-black-knights-team-basketball-jersey-gold-ncaa" },
  { sport: "NCAA football", slug: "5-arkansas-razorbacks-untouchable-football-jersey-white-ncaa" },
  { sport: "International", slug: "aaron-hickey-brentford-2-jersey" }
] as const;

function collect(page: Page) {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));
  page.on("response", (res) => {
    if (res.status() >= 400 && !res.url().includes("favicon")) {
      networkErrors.push(`${res.status()} ${res.url()}`);
    }
  });
  return { consoleErrors, networkErrors };
}

test.describe("customer journey audit", () => {
  test("full audit capture", async ({ page }) => {
    test.setTimeout(600_000);
    const findings: Finding[] = [];
    const { consoleErrors, networkErrors } = collect(page);
    await dismissWelcomeOffer(page);

    // Homepage
    await page.goto("/", { waitUntil: "networkidle" });
    await page.screenshot({ path: join(SCREENSHOT_DIR, "audit-01-home-desktop.png"), fullPage: true });
    const heroCta = page.getByRole("link", { name: /shop|browse|products/i }).first();
    if (!(await heroCta.isVisible())) {
      findings.push({
        id: "CJA-001",
        severity: "P2",
        journey: "Homepage",
        url: "/",
        problem: "No prominent shop/browse CTA visible on homepage hero",
        evidence: "Hero CTA link not found with shop/browse/products pattern",
        recommendedFix: "Add clear primary CTA above the fold linking to /products or featured collection"
      });
    }

    // Header nav
    await expect(page.locator("header")).toBeVisible();
    const navLinks = await page.locator("header a").allTextContents();
    if (!navLinks.some((t) => /products/i.test(t))) {
      findings.push({
        id: "CJA-002",
        severity: "P1",
        journey: "Header/navigation",
        url: "/",
        problem: "Products link missing from header",
        evidence: `Header links: ${navLinks.join(", ")}`,
        recommendedFix: "Ensure Products nav link is visible on desktop and mobile"
      });
    }

    // Mobile homepage
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.screenshot({ path: join(SCREENSHOT_DIR, "audit-02-home-mobile.png"), fullPage: true });

    // Collections
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/collections", { waitUntil: "networkidle" });
    await page.screenshot({ path: join(SCREENSHOT_DIR, "audit-03-collections.png"), fullPage: true });
    const uglySlug = await page.locator("a[href*='chatgpt']").count();
    if (uglySlug > 0) {
      findings.push({
        id: "CJA-003",
        severity: "P2",
        journey: "Collections",
        url: "/collections",
        problem: "Internal/AI-generated collection slug visible in additional collections list",
        evidence: "Link containing 'chatgpt' found on collections page",
        recommendedFix: "Internal collections filtered from customer index"
      });
    }

    // Product listing
    await page.goto("/products", { waitUntil: "networkidle" });
    await page.screenshot({ path: join(SCREENSHOT_DIR, "audit-04-products-plp.png"), fullPage: true });
    const productCards = await page.locator('a[href^="/products/"]').count();
    if (productCards < 5) {
      findings.push({
        id: "CJA-004",
        severity: "P1",
        journey: "Product listing",
        url: "/products",
        problem: "Very few products visible on PLP",
        evidence: `Only ${productCards} product links found`,
        recommendedFix: "Verify published product count and PLP pagination"
      });
    }

    // Search
    await page.goto("/search?q=NHL", { waitUntil: "networkidle" });
    await page.screenshot({ path: join(SCREENSHOT_DIR, "audit-05-search-nhl.png"), fullPage: true });
    const nhlResults = await page.locator('a[href^="/products/"]').count();
    if (nhlResults === 0) {
      findings.push({
        id: "CJA-005",
        severity: "P1",
        journey: "Search",
        url: "/search?q=NHL",
        problem: "NHL search returns no product results",
        evidence: "Zero product links on search results page",
        recommendedFix: "Fix search indexing for NHL products"
      });
    }

    // Sport PDP sampling
    for (const sample of SPORT_PRODUCTS) {
      const url = `/products/${sample.slug}`;
      const res = await page.goto(url, { waitUntil: "networkidle" });
      if (!res || res.status() >= 400) {
        findings.push({
          id: `CJA-SPORT-${sample.sport}`,
          severity: "P1",
          journey: `PDP ${sample.sport}`,
          url,
          problem: `${sample.sport} sample product not reachable`,
          evidence: `HTTP ${res?.status() ?? "no response"}`,
          recommendedFix: "Use a published representative product for this sport"
        });
        continue;
      }

      const bodyText = await page.locator("main").innerText();
      if (/default title/i.test(bodyText) && /size/i.test(bodyText)) {
        const sizeSection = bodyText.match(/Size[\s\S]{0,200}/i)?.[0] ?? "";
        if (/default title/i.test(sizeSection)) {
          findings.push({
            id: `CJA-SIZE-${sample.sport}`,
            severity: "P1",
            journey: `PDP ${sample.sport}`,
            url,
            problem: "Size picker shows 'Default Title' instead of real sizes",
            evidence: sizeSection.slice(0, 120),
            recommendedFix: "Map Shopify Default Title variants to Aris size option set (catalogue data)"
          });
        }
      }

      const sizeGroup = page.getByRole("radiogroup", { name: /select size/i });
      if ((await sizeGroup.count()) === 0) {
        findings.push({
          id: `CJA-NOSIZE-${sample.sport}`,
          severity: "P1",
          journey: `PDP ${sample.sport}`,
          url,
          problem: "No size selector on PDP",
          evidence: "Size radiogroup not found",
          recommendedFix: "Attach size option set or variant sizes for this product"
        });
      }

      const internalWording = ["optionSetSlug", "variantId", "shopify", "draft", "null"];
      for (const word of internalWording) {
        if (bodyText.toLowerCase().includes(word.toLowerCase())) {
          findings.push({
            id: `CJA-INTERNAL-${sample.sport}-${word}`,
            severity: "P2",
            journey: `PDP ${sample.sport}`,
            url,
            problem: `Customer-facing internal wording: '${word}'`,
            evidence: `Found in page text`,
            recommendedFix: "Remove debug/internal labels from PDP UI"
          });
        }
      }
    }

    // Colour-only and Default Title known samples
    await page.goto(SAMPLE_PRODUCTS.mlbColour, { waitUntil: "networkidle" });
    await page.screenshot({ path: join(SCREENSHOT_DIR, "audit-06-mlb-colour-pdp.png"), fullPage: true });
    const colourGroup = page.getByRole("radiogroup", { name: /select colour/i });
    if ((await colourGroup.count()) === 0) {
      findings.push({
        id: "CJA-006",
        severity: "P1",
        journey: "Colour selection",
        url: SAMPLE_PRODUCTS.mlbColour,
        problem: "Colour-only MLB product missing colour picker",
        evidence: "No colour radiogroup on known colour-variant product",
        recommendedFix: "Show colour selector when product has colour variants"
      });
    }

    await page.goto(SAMPLE_PRODUCTS.nhlDefaultTitle, { waitUntil: "networkidle" });
    await page.screenshot({ path: join(SCREENSHOT_DIR, "audit-07-nhl-default-title-pdp.png"), fullPage: true });

    // Size guide
    const sizeGuideBtn = page.getByRole("button", { name: /size guide/i });
    if ((await sizeGuideBtn.count()) > 0) {
      await sizeGuideBtn.first().click();
      await page.screenshot({ path: join(SCREENSHOT_DIR, "audit-08-size-guide-modal.png") });
      const modal = page.locator("[role='dialog'], .modal, .size-guide");
      if ((await modal.count()) === 0) {
        findings.push({
          id: "CJA-007",
          severity: "P2",
          journey: "Size guide",
          url: SAMPLE_PRODUCTS.nhlDefaultTitle,
          problem: "Size guide button does not open visible modal/panel",
          evidence: "No dialog after clicking size guide",
          recommendedFix: "Ensure size guide modal renders with chart content"
        });
      }
    } else {
      findings.push({
        id: "CJA-008",
        severity: "P2",
        journey: "Size guide",
        url: SAMPLE_PRODUCTS.nhlDefaultTitle,
        problem: "Size guide button not present on sampled PDP",
        evidence: "No size guide button found",
        recommendedFix: "Attach size chart data or show generic apparel guide"
      });
    }

    // Customisation flow
    await page.goto(SAMPLE_PRODUCTS.soccer, { waitUntil: "networkidle" });
    await page.getByRole("radiogroup", { name: /^Customisation$/i }).getByRole("radio", { name: /^Yes/i }).click();
    await page.getByLabel(/^Name$/i).fill("AUDIT");
    await page.getByLabel(/^Number$/i).fill("99");
    await page.screenshot({ path: join(SCREENSHOT_DIR, "audit-09-customisation.png"), fullPage: true });
    const customPrice = await page.getByText(/customisation|personalisation/i).first().textContent();
    if (!customPrice || !/\d/.test(customPrice)) {
      findings.push({
        id: "CJA-009",
        severity: "P2",
        journey: "Customisation",
        url: SAMPLE_PRODUCTS.soccer,
        problem: "Customisation pricing not clearly shown when enabled",
        evidence: `Customisation text: ${customPrice ?? "none"}`,
        recommendedFix: "Show customisation add-on price near Yes/No toggle"
      });
    }

    // Cart with customisation
    const sizeGroup = page.getByRole("radiogroup", { name: /select size/i });
    if (await sizeGroup.count()) {
      await sizeGroup.getByRole("radio").first().click();
    }
    const colour = page.getByRole("radiogroup", { name: /select colour/i });
    if (await colour.count()) await colour.getByRole("radio").first().click();
    await page.getByRole("button", { name: /add to cart/i }).click();
    await expect(page.getByText(/added to cart/i)).toBeVisible({ timeout: 15000 });

    await page.goto("/cart", { waitUntil: "networkidle" });
    await page.screenshot({ path: join(SCREENSHOT_DIR, "audit-10-cart-desktop.png"), fullPage: true });
    const cartText = await page.locator("main").innerText();
    if (!/AUDIT/i.test(cartText) || !/99/.test(cartText)) {
      findings.push({
        id: "CJA-010",
        severity: "P1",
        journey: "Cart",
        url: "/cart",
        problem: "Customisation not preserved in cart display",
        evidence: cartText.slice(0, 300),
        recommendedFix: "Ensure cart line shows name/number from customisation"
      });
    }
    if (/USD/i.test(cartText) && /GBP|£/.test(cartText)) {
      findings.push({
        id: "CJA-011",
        severity: "P1",
        journey: "Cart",
        url: "/cart",
        problem: "Mixed currency display in cart",
        evidence: "Both USD and GBP symbols found",
        recommendedFix: "Normalize cart to single currency from line items"
      });
    }

    // Checkout
    await page.goto("/checkout", { waitUntil: "networkidle" });
    await page.screenshot({ path: join(SCREENSHOT_DIR, "audit-11-checkout-desktop.png"), fullPage: true });
    const checkoutText = await page.locator("main").innerText();
    if (/calculated later/i.test(checkoutText)) {
      findings.push({
        id: "CJA-012",
        severity: "P1",
        journey: "Checkout",
        url: "/checkout",
        problem: "Checkout still says shipping calculated later",
        evidence: "Found 'calculated later' text",
        recommendedFix: "Replace with honest made-to-order shipping messaging + link to policy"
      });
    }
    if (/not yet available/i.test(checkoutText)) {
      findings.push({
        id: "CJA-013",
        severity: "P1",
        journey: "Checkout",
        url: "/checkout",
        problem: "Checkout contains stale 'not yet available' copy",
        evidence: "Found 'not yet available'",
        recommendedFix: "Update checkout trust/copy to reflect live checkout"
      });
    }

    // Mobile checkout
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/checkout", { waitUntil: "networkidle" });
    await page.screenshot({ path: join(SCREENSHOT_DIR, "audit-12-checkout-mobile.png"), fullPage: true });

    // Back/forward from checkout to cart
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cart", { waitUntil: "networkidle" });
    await page.goto("/checkout", { waitUntil: "networkidle" });
    await page.goBack();
    const backOnCart = page.url().includes("/cart");
    if (!backOnCart) {
      findings.push({
        id: "CJA-014",
        severity: "P2",
        journey: "Back navigation",
        url: "/checkout",
        problem: "Browser back from checkout did not return to cart",
        evidence: `URL after back: ${page.url()}`,
        recommendedFix: "Ensure checkout is standard navigation, not replace"
      });
    }
    await page.goForward();
    await page.reload();
    const afterRefresh = await page.locator("main").innerText();
    if (!/complete your order|checkout/i.test(afterRefresh)) {
      findings.push({
        id: "CJA-015",
        severity: "P1",
        journey: "Refresh at checkout",
        url: "/checkout",
        problem: "Checkout page broken after refresh",
        evidence: afterRefresh.slice(0, 200),
        recommendedFix: "Persist cart session across checkout refresh"
      });
    }

    // Policy pages
    for (const policy of ["shipping", "returns", "privacy"]) {
      await page.goto(`/pages/${policy}`, { waitUntil: "networkidle" });
      const policyText = await page.locator("main").innerText();
      if (/not yet available/i.test(policyText)) {
        findings.push({
          id: `CJA-POLICY-${policy}`,
          severity: "P1",
          journey: "Policy",
          url: `/pages/${policy}`,
          problem: `Stale policy copy on ${policy}`,
          evidence: "Contains 'not yet available'",
          recommendedFix: "Update policy to reflect live checkout"
        });
      }
    }

    // Cart noindex
    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    const robotsMeta = await page.locator('meta[name="robots"]').getAttribute("content");
    if (!robotsMeta || !/noindex/i.test(robotsMeta)) {
      findings.push({
        id: "CJA-016",
        severity: "P2",
        journey: "SEO",
        url: "/cart",
        problem: "Cart page may be indexable",
        evidence: `robots meta: ${robotsMeta ?? "missing"}`,
        recommendedFix: "Set noindex on cart metadata"
      });
    }

    // Console/network summary
    if (consoleErrors.length > 0) {
      findings.push({
        id: "CJA-CONSOLE",
        severity: "P2",
        journey: "Technical",
        url: "multiple",
        problem: "Console errors during audit session",
        evidence: consoleErrors.slice(0, 5).join("; "),
        recommendedFix: "Fix client-side errors shown in browser console"
      });
    }
    if (networkErrors.length > 0) {
      const critical = networkErrors.filter((e) => e.startsWith("5"));
      if (critical.length > 0) {
        findings.push({
          id: "CJA-NETWORK",
          severity: "P0",
          journey: "Technical",
          url: "multiple",
          problem: "5xx network errors during audit",
          evidence: critical.slice(0, 5).join("; "),
          recommendedFix: "Fix failing API routes"
        });
      }
    }

    mkdirSync(OUT_DIR, { recursive: true });
    const summary = {
      auditDate: new Date().toISOString(),
      findings,
      counts: {
        P0: findings.filter((f) => f.severity === "P0").length,
        P1: findings.filter((f) => f.severity === "P1").length,
        P2: findings.filter((f) => f.severity === "P2").length,
        P3: findings.filter((f) => f.severity === "P3").length
      },
      consoleErrors: consoleErrors.slice(0, 30),
      networkErrors: networkErrors.slice(0, 30)
    };
    writeFileSync(join(OUT_DIR, "customer-journey-audit.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary.counts));
  });
});
