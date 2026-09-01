import { test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://sports-jersey-house.vercel.app";
const VARIANT_ID = "31469f6b-8568-4f4c-989d-acb8ca263dd7";
const OUT = join(process.cwd(), "../../docs/ux-audit-screenshots/audit-13-order-success.png");

function parseSetCookie(headers: Headers): string {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const list =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : ([headers.get("set-cookie")].filter(Boolean) as string[]);
  return list.map((c) => c.split(";")[0]!).filter(Boolean).join("; ");
}

async function payStripeCheckout(page: import("@playwright/test").Page, cardNumber: string) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);
  const cardRadio = page.locator("#payment-method-accordion-item-title-card");
  if (await cardRadio.count()) {
    await cardRadio.click({ force: true });
    await page.waitForTimeout(1000);
  }
  const tryFill = async (locator: ReturnType<typeof page.locator>, value: string) => {
    if (await locator.count()) {
      await locator.first().click({ timeout: 5000 }).catch(() => undefined);
      await locator.first().fill(value, { timeout: 5000 }).catch(() => undefined);
    }
  };
  await tryFill(page.locator('input[name="cardNumber"]'), cardNumber);
  await tryFill(page.locator('input[name="cardExpiry"]'), "12 / 34");
  await tryFill(page.locator('input[name="cardCvc"]'), "123");
  await tryFill(page.locator('input[name="billingName"]'), "STRIPE TEST");
  await tryFill(page.locator('input[name="billingPostalCode"]'), "78701");
  for (const frame of page.frames()) {
    await tryFill(frame.locator('input[name="cardnumber"]'), cardNumber);
    await tryFill(frame.locator('input[placeholder="Card number"]'), cardNumber);
    await tryFill(frame.locator('input[placeholder="MM / YY"]'), "12 / 34");
    await tryFill(frame.locator('input[placeholder="CVC"]'), "123");
  }
  await page.locator('button[type="submit"]:visible').first().click({ timeout: 15000 });
}

test("payment audit stripe test", async ({ page }) => {
  test.setTimeout(300_000);
  const results: Record<string, unknown>[] = [];

  const addRes = await fetch(`${BASE}/api/cart/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      variantId: VARIANT_ID,
      quantity: 1,
      selectedOptions: {
        size: "M/Men's",
        customisation: { enabled: true, name: "PAY-AUDIT", number: "07", message: "AUDIT" }
      }
    })
  });
  const cookie = parseSetCookie(addRes.headers);
  const cart = await addRes.json();
  results.push({
    step: "cart",
    ok: cart?.cart?.currencyCode === "GBP",
    currency: cart?.cart?.currencyCode,
    subtotal: cart?.cart?.subtotalAmount
  });

  const checkoutRes = await fetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      email: `audit.pay+${Date.now()}@sjh-internal.test`,
      phone: "+15555550999",
      shippingAddress: {
        fullName: "AUDIT PAY",
        line1: "1 Test St",
        city: "Austin",
        region: "TX",
        postalCode: "78701",
        country: "US"
      }
    })
  });
  const checkout = await checkoutRes.json();
  results.push({
    step: "checkout_session",
    ok: checkoutRes.ok,
    orderNumber: checkout.orderNumber,
    total: checkout.totalAmount,
    currency: checkout.currencyCode
  });

  await page.goto(checkout.checkoutUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  results.push({ step: "stripe_hosted", ok: page.url().includes("checkout.stripe.com") });

  await payStripeCheckout(page, "4242424242424242");
  await page.waitForURL(/sports-jersey-house\.vercel\.app\/orders\//, { timeout: 120000 });
  const successText = await page.locator("main").innerText();
  results.push({
    step: "success_page",
    ok: /paid|thank|order/i.test(successText),
    url: page.url(),
    hasOrderNum: successText.includes(checkout.orderNumber)
  });
  await page.screenshot({ path: OUT, fullPage: true });

  await page.reload();
  const refreshText = await page.locator("main").innerText();
  results.push({
    step: "success_refresh",
    ok: refreshText.includes(checkout.orderNumber),
    duplicate: /duplicate/i.test(refreshText)
  });

  writeFileSync(
    join(process.cwd(), "e2e/test-results/payment-audit.json"),
    JSON.stringify({ results, orderNumber: checkout.orderNumber }, null, 2)
  );
  console.log(JSON.stringify(results, null, 2));
});
