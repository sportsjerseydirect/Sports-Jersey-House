/**
 * Production Stripe SANDBOX E2E against https://sports-jersey-house.vercel.app
 * Uses TEST card 4242 only. Does NOT synthetically mark orders paid.
 */
import postgres from "postgres";
import {
  createPurchaseOrderBatch,
  getOrderMargins,
  getOrderPaymentState,
  getSupplierPurchaseOrderDetail,
  getSupplierUserByEmail,
  markOrderPaidFromStripe,
  supplierAcknowledgePo,
  supplierSubmitCost
} from "../index";
import { completeCheckoutUrl } from "./pay-stripe-checkout";

const BASE = "https://sports-jersey-house.vercel.app";
const VARIANT_ID = "31469f6b-8568-4f4c-989d-acb8ca263dd7";
const TEST_MARKER = "PROD-STRIPE-TEST";

function dbUrl(): string {
  const url = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!url) throw new Error("DATABASE_URL required");
  return url;
}

function parseSetCookie(headers: Headers): string {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const list =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : ([headers.get("set-cookie")].filter(Boolean) as string[]);
  return list
    .map((c) => c.split(";")[0]!)
    .filter(Boolean)
    .join("; ");
}

async function createCheckout(email: string, name: string) {
  const addRes = await fetch(`${BASE}/api/cart/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      variantId: VARIANT_ID,
      quantity: 1,
      selectedOptions: {
        size: "M/Men's",
        customisation: {
          enabled: true,
          name: "STRIPE TEST",
          number: "07",
          message: "PRODUCTION TEST"
        }
      }
    })
  });
  const cookie = parseSetCookie(addRes.headers);
  if (!addRes.ok || !cookie) {
    const errBody = await addRes.text().catch(() => "");
    throw new Error(`cart add failed: ${addRes.status} ${errBody}`);
  }

  const checkoutRes = await fetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie
    },
    body: JSON.stringify({
      email,
      phone: "+15555550999",
      shippingAddress: {
        fullName: name,
        line1: "100 Production Test St",
        city: "Austin",
        region: "TX",
        postalCode: "78701",
        country: "US"
      },
      customerNotes: `${TEST_MARKER} sandbox verification`
    })
  });
  const body = await checkoutRes.json();
  if (!checkoutRes.ok || !body.checkoutUrl || !body.orderNumber) {
    throw new Error(`checkout failed: ${JSON.stringify(body)}`);
  }
  return body as {
    orderNumber: string;
    checkoutUrl: string;
    checkoutSessionId?: string;
  };
}

async function waitForPaid(orderNumber: string, url: string, attempts = 45) {
  for (let i = 0; i < attempts; i++) {
    const state = await getOrderPaymentState(orderNumber, url);
    if (state?.status === "paid" && state.paidAt && state.stripePaymentIntentId) {
      return state;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return getOrderPaymentState(orderNumber, url);
}

async function main() {
  const url = dbUrl();
  const sql = postgres(url, { ssl: "require", max: 1, prepare: false, connect_timeout: 30 });
  const results: Array<{ step: string; ok: boolean; detail?: unknown }> = [];
  const report: Record<string, unknown> = { base: BASE, marker: TEST_MARKER };

  try {
    const health = await (await fetch(`${BASE}/api/health`)).json();
    report.healthStripe = health.stripe;
    results.push({
      step: "health_ready",
      ok: Boolean(health?.stripe?.readyForTestCheckout) && health?.shopifySyncEnabled === false,
      detail: {
        ready: health?.stripe?.readyForTestCheckout,
        secretKeyPrefix: health?.stripe?.secretKeyPrefix,
        publishableKeyPrefix: health?.stripe?.publishableKeyPrefix,
        webhookMatched: health?.stripe?.webhookEndpoint?.matchedUrl,
        shopify: health?.shopifySyncEnabled
      }
    });

    const checkout = await createCheckout(
      `prod.stripe+${Date.now()}@sjh-internal.test`,
      `${TEST_MARKER} Customer`
    );
    report.orderNumber = checkout.orderNumber;
    report.checkoutSessionId = checkout.checkoutSessionId;

    const paidUi = await completeCheckoutUrl(checkout.checkoutUrl, "4242424242424242");
    results.push({
      step: "stripe_checkout_success_redirect",
      ok: paidUi.ok,
      detail: paidUi
    });
    if (!paidUi.ok) throw new Error(`Stripe pay failed: ${JSON.stringify(paidUi)}`);

    const paidState = await waitForPaid(checkout.orderNumber, url);
    report.paymentState = {
      status: paidState?.status,
      hasSession: Boolean(paidState?.stripeCheckoutSessionId),
      hasPi: Boolean(paidState?.stripePaymentIntentId),
      fee: paidState?.paymentFeeAmount,
      paidAt: paidState?.paidAt
    };

    const [realEvent] = await sql`
      SELECT id, event_type, processing_status
      FROM stripe_webhook_events
      WHERE stripe_checkout_session_id = ${paidState?.stripeCheckoutSessionId ?? null}
         OR order_id = ${paidState?.id ?? null}
      ORDER BY received_at DESC
      LIMIT 5`;
    const realWebhook =
      typeof realEvent?.id === "string" &&
      realEvent.id.startsWith("evt_") &&
      !realEvent.id.startsWith("evt_prod_dup_") &&
      !realEvent.id.startsWith("evt_test_");
    report.webhookEvent = realEvent ?? null;
    results.push({
      step: "real_stripe_webhook_paid",
      ok:
        Boolean(paidState?.paidAt) &&
        Boolean(paidState?.stripePaymentIntentId) &&
        Boolean(realWebhook),
      detail: {
        status: paidState?.status,
        hasPi: Boolean(paidState?.stripePaymentIntentId),
        fee: paidState?.paymentFeeAmount,
        eventIdPrefix: typeof realEvent?.id === "string" ? realEvent.id.slice(0, 8) : null,
        eventType: realEvent?.event_type ?? null
      }
    });

    const [line] = await sql`
      SELECT customisation, size_label, colour_label, selected_options
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.order_number = ${checkout.orderNumber}
      LIMIT 1`;
    const custom = line?.customisation as { name?: string; number?: string; message?: string; mode?: string };
    const selected = line?.selected_options as { size?: string; customisation?: { enabled?: boolean } } | null;
    results.push({
      step: "customisation_preserved",
      ok:
        custom?.name === "STRIPE TEST" &&
        custom?.number === "07" &&
        custom?.message === "PRODUCTION TEST" &&
        line?.size_label === "M/Men's" &&
        selected?.size === "M/Men's",
      detail: {
        custom,
        sizeLabel: line?.size_label,
        colourLabel: line?.colour_label,
        selectedSize: selected?.size
      }
    });

    // Duplicate delivery of the SAME real event id must be idempotent.
    if (realEvent?.id && paidState) {
      const dup = await markOrderPaidFromStripe(
        {
          eventId: realEvent.id,
          eventType: "checkout.session.completed",
          livemode: false,
          orderId: paidState.id,
          orderNumber: checkout.orderNumber,
          checkoutSessionId: paidState.stripeCheckoutSessionId ?? null,
          paymentIntentId: paidState.stripePaymentIntentId ?? null
        },
        url
      );
      const [orderCount] = await sql`
        SELECT count(*)::int AS n FROM orders WHERE order_number = ${checkout.orderNumber}`;
      results.push({
        step: "duplicate_webhook",
        ok: dup.duplicateEvent === true && orderCount?.n === 1,
        detail: { dup, orderCount: orderCount?.n }
      });
    } else {
      results.push({
        step: "duplicate_webhook",
        ok: false,
        detail: "skipped — no real Stripe event id yet"
      });
    }

    // Success page refresh must not duplicate the order.
    const before = await sql`SELECT count(*)::int AS n FROM orders WHERE order_number=${checkout.orderNumber}`;
    await fetch(`${BASE}/orders/${encodeURIComponent(checkout.orderNumber)}?checkout=success`);
    await fetch(`${BASE}/orders/${encodeURIComponent(checkout.orderNumber)}?checkout=success`);
    const after = await sql`SELECT count(*)::int AS n FROM orders WHERE order_number=${checkout.orderNumber}`;
    results.push({
      step: "success_page_refresh_no_dup",
      ok: before[0]?.n === 1 && after[0]?.n === 1,
      detail: { before: before[0]?.n, after: after[0]?.n }
    });

    const batch = await createPurchaseOrderBatch(new Date().toISOString().slice(0, 10), url);
    let poNumber =
      batch.created.find((po) => po.lines.some((l) => l.orderNumber === checkout.orderNumber))
        ?.poNumber ?? null;
    if (!poNumber) {
      const [existing] = await sql`
        SELECT po.po_number
        FROM purchase_orders po
        JOIN order_items oi ON oi.purchase_order_id = po.id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.order_number = ${checkout.orderNumber}
        LIMIT 1`;
      poNumber = existing?.po_number ?? null;
    }
    report.poNumber = poNumber;
    results.push({ step: "po_after_paid", ok: Boolean(poNumber), detail: { poNumber } });

    if (poNumber) {
      const supplierUser = await getSupplierUserByEmail("supplier@sjh.local", url);
      if (!supplierUser) throw new Error("supplier@sjh.local missing");
      const detail = await getSupplierPurchaseOrderDetail(supplierUser.supplierId, poNumber, url);
      const hasCustom = detail.lines.some(
        (l) =>
          l.customisation.name === "STRIPE TEST" &&
          l.customisation.number === "07" &&
          l.customisation.message === "PRODUCTION TEST"
      );
      const hasSize = detail.lines.some((l) => l.sizeLabel === "M/Men's");
      // Catalogue SKUs are often null for migrated Shopify "Default Title" variants.
      // Require variant + size fields; surface sku/supplierSku when present.
      const hasVariant = detail.lines.some((l) => Boolean(l.variantTitle));
      const blob = JSON.stringify(detail);
      const leak = /unitPrice|sellingPrice|marginPercent|grossProfit|paymentFee|totalAmount/i.test(
        blob
      );
      results.push({
        step: "supplier_portal",
        ok: hasCustom && hasSize && !leak && hasVariant && Boolean(detail.lines[0]?.imageUrl),
        detail: {
          hasCustom,
          hasSize,
          hasVariant,
          leak,
          hasImage: Boolean(detail.lines[0]?.imageUrl),
          sku: detail.lines[0]?.sku ?? detail.lines[0]?.supplierSku ?? null,
          variantTitle: detail.lines[0]?.variantTitle ?? null,
          sizeLabel: detail.lines[0]?.sizeLabel ?? null,
          colourLabel: detail.lines[0]?.colourLabel ?? null
        }
      });

      await supplierAcknowledgePo(supplierUser.supplierId, supplierUser.id, poNumber, url);
      await supplierSubmitCost(
        supplierUser.supplierId,
        supplierUser.id,
        { poNumber, amount: "22.00", shippingCost: "5.00", notes: `${TEST_MARKER} cost` },
        url
      );
      const margins = await getOrderMargins(checkout.orderNumber, url);
      const fee = Number.parseFloat(paidState?.paymentFeeAmount || "0");
      const totals = margins?.totals;
      const gpOk =
        Boolean(totals) &&
        Number.parseFloat(totals!.totalCostAmount) >= 27 &&
        Number.parseFloat(totals!.grossProfitAmount) > 0;
      report.margin = totals;
      results.push({
        step: "margin_includes_stripe_fee",
        ok: gpOk && fee >= 0,
        detail: { totals, paymentFeeAmount: paidState?.paymentFeeAmount }
      });
    }

    // Cancelled checkout — no pay, no PO
    const cancel = await createCheckout(
      `prod.cancel+${Date.now()}@sjh-internal.test`,
      `${TEST_MARKER} Cancel`
    );
    report.cancelOrderNumber = cancel.orderNumber;
    const cancelState = await getOrderPaymentState(cancel.orderNumber, url);
    const cancelBatch = await createPurchaseOrderBatch(new Date().toISOString().slice(0, 10), url);
    const cancelPo = cancelBatch.created.some((po) =>
      po.lines.some((l) => l.orderNumber === cancel.orderNumber)
    );
    results.push({
      step: "cancelled_no_po",
      ok: cancelState?.status === "pending_payment" && !cancelPo,
      detail: { orderNumber: cancel.orderNumber, status: cancelState?.status, poCreated: cancelPo }
    });

    // Failed / declined payment — no PO
    const fail = await createCheckout(
      `prod.fail+${Date.now()}@sjh-internal.test`,
      `${TEST_MARKER} Fail`
    );
    report.failOrderNumber = fail.orderNumber;
    const failPay = await completeCheckoutUrl(fail.checkoutUrl, "4000000000000002");
    await new Promise((r) => setTimeout(r, 5000));
    const failState = await getOrderPaymentState(fail.orderNumber, url);
    const failBatch = await createPurchaseOrderBatch(new Date().toISOString().slice(0, 10), url);
    const failPo = failBatch.created.some((po) =>
      po.lines.some((l) => l.orderNumber === fail.orderNumber)
    );
    results.push({
      step: "failed_payment_no_po",
      ok: failState?.status === "pending_payment" && !failPo,
      detail: {
        orderNumber: fail.orderNumber,
        status: failState?.status,
        poCreated: failPo,
        payUi: failPay
      }
    });

    const failed = results.filter((r) => !r.ok);
    console.log(JSON.stringify({ report, results, failed: failed.length }, null, 2));
    await sql.end({ timeout: 5 });
    process.exit(failed.length ? 1 : 0);
  } catch (error) {
    console.error(JSON.stringify({ report, results, error: error instanceof Error ? error.message : String(error) }, null, 2));
    await sql.end({ timeout: 5 }).catch(() => undefined);
    process.exit(1);
  }
}

main();
