import { chromium, type Page } from "playwright";

export async function payStripeCheckout(page: Page, cardNumber: string) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);

  const cardRadio = page.locator("#payment-method-accordion-item-title-card");
  if (await cardRadio.count()) {
    await cardRadio.click({ force: true });
    await page.waitForTimeout(1000);
  }

  const tryFill = async (locator: ReturnType<Page["locator"]>, value: string) => {
    if (await locator.count()) {
      await locator.first().click({ timeout: 5000 }).catch(() => undefined);
      await locator.first().fill(value, { timeout: 5000 }).catch(() => undefined);
      return true;
    }
    return false;
  };

  // Hosted Checkout sometimes uses top-level inputs.
  await tryFill(page.locator('input[name="cardNumber"]'), cardNumber);
  await tryFill(page.locator('input[name="cardExpiry"]'), "12 / 34");
  await tryFill(page.locator('input[name="cardCvc"]'), "123");
  await tryFill(page.locator('input[name="billingName"]'), "STRIPE TEST");
  await tryFill(page.locator('input[name="billingPostalCode"]'), "78701");

  // Card Element iframes
  for (const frame of page.frames()) {
    await tryFill(frame.locator('input[name="cardnumber"]'), cardNumber);
    await tryFill(frame.locator('input[name="exp-date"]'), "1234");
    await tryFill(frame.locator('input[name="cvc"]'), "123");
    await tryFill(frame.locator('input[placeholder="Card number"]'), cardNumber);
    await tryFill(frame.locator('input[placeholder="MM / YY"]'), "12 / 34");
    await tryFill(frame.locator('input[placeholder="CVC"]'), "123");
    await tryFill(frame.locator('input[autocomplete="cc-number"]'), cardNumber);
    await tryFill(frame.locator('input[autocomplete="cc-exp"]'), "12 / 34");
    await tryFill(frame.locator('input[autocomplete="cc-csc"]'), "123");
  }

  const postal = page.locator('input[name="billingPostalCode"], input[autocomplete="postal-code"]');
  if (await postal.count()) {
    await postal.first().fill("78701").catch(() => undefined);
  }
  const name = page.locator('input[name="billingName"], input[autocomplete="cc-name"]');
  if (await name.count()) {
    await name.first().fill("STRIPE TEST").catch(() => undefined);
  }

  const pay = page.locator('button[type="submit"]:visible').first();
  await pay.click({ timeout: 15000 });
}

export async function completeCheckoutUrl(checkoutUrl: string, cardNumber = "4242424242424242") {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(checkoutUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await payStripeCheckout(page, cardNumber);
    await page.waitForURL(/sports-jersey-house\.vercel\.app\/orders\//, { timeout: 120000 });
    return { ok: true, finalUrl: page.url() };
  } catch (error) {
    return {
      ok: false,
      finalUrl: page.url(),
      error: error instanceof Error ? error.message : String(error),
      title: await page.title().catch(() => "")
    };
  } finally {
    await browser.close();
  }
}

if (process.argv[1]?.includes("pay-stripe-checkout") && process.argv[2]) {
  completeCheckoutUrl(process.argv[2], process.argv[3] ?? "4242424242424242").then((result) => {
    console.log(JSON.stringify(result));
    process.exit(result.ok ? 0 : 1);
  });
}
