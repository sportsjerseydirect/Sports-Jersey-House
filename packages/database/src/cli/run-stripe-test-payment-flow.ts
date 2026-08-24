/**
 * Stripe TEST-MODE end-to-end: order → Checkout Session → pay/fail → webhook logic → PO → margin.
 *
 * Requires:
 *   ENABLE_STRIPE_PAYMENTS=true
 *   STRIPE_SECRET_KEY=sk_test_...
 *   DATABASE_URL=...
 *
 * Usage:
 *   npx pnpm@9.15.0 exec tsx --env-file=.env packages/database/src/cli/run-stripe-test-payment-flow.ts
 */
import postgres from "postgres";
import { Stripe } from "stripe";
import type { GuestCheckoutInput } from "@sjh/shared";
import {
  addItemToCart,
  amountToStripeCents,
  attachStripeCheckoutSession,
  clearCart,
  createPurchaseOrderBatch,
  getOrderMargins,
  getOrderPaymentState,
  getSupplierPurchaseOrderDetail,
  getSupplierUserByEmail,
  markOrderPaidFromStripe,
  resolveCartCustomisationPricing,
  supplierAcknowledgePo,
  supplierSubmitCost,
  supplierSubmitTracking
} from "../index";
import { createOrderFromCart } from "../orders";

const TEST_MARKER = "STRIPE-TEST";
const SESSION = `stripe-test-${Date.now()}`;

function dbUrl(): string {
  const url = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!url) throw new Error("DATABASE_URL required");
  return url;
}

function requireTestStripe(): Stripe {
  if (process.env.ENABLE_STRIPE_PAYMENTS !== "true") {
    throw new Error("ENABLE_STRIPE_PAYMENTS must be true");
  }
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY required");
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_") && !key.startsWith("rkcs_test_") && !/_(test)_/.test(key)) {
    throw new Error("STRIPE_SECRET_KEY must be a TEST key. Live keys blocked.");
  }
  if (key.includes("_live_")) {
    throw new Error("STRIPE_SECRET_KEY must be a TEST key. Live keys blocked.");
  }
  return new Stripe(key, { apiVersion: "2026-07-29.dahlia", typescript: true });
}

type StepResult = { step: string; ok: boolean; detail?: unknown; error?: string };

async function confirmTestCardPayment(
  stripe: Stripe,
  input: {
    amountCents: number;
    currency: string;
    orderId: string;
    orderNumber: string;
    checkoutSessionId: string;
    paymentMethod: string;
  }
): Promise<Stripe.PaymentIntent> {
  const session = await stripe.checkout.sessions.retrieve(input.checkoutSessionId, {
    expand: ["payment_intent"]
  });
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  if (!paymentIntentId) {
    return stripe.paymentIntents.create({
      amount: input.amountCents,
      currency: input.currency.toLowerCase(),
      confirm: true,
      payment_method: input.paymentMethod,
      return_url: "https://example.com/return",
      metadata: {
        sjh_order_id: input.orderId,
        sjh_order_number: input.orderNumber,
        sjh_checkout_session_id: input.checkoutSessionId
      },
      automatic_payment_methods: { enabled: true, allow_redirects: "never" }
    });
  }

  return stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: input.paymentMethod,
    return_url: "https://example.com/return"
  });
}

async function main(): Promise<void> {
  const url = dbUrl();
  const stripe = requireTestStripe();
  const sql = postgres(url, { max: 1, prepare: false, ssl: "require", connect_timeout: 30 });
  const results: StepResult[] = [];
  const report: Record<string, unknown> = { session: SESSION, marker: TEST_MARKER, livemode: false };

  try {
    const [product] = await sql`
      SELECT p.id, p.slug, p.title, pv.id AS variant_id, pv.title AS variant_title, pv.price_amount, pv.currency_code
      FROM products p
      INNER JOIN product_variants pv ON pv.product_id = p.id AND pv.deleted_at IS NULL
      WHERE p.deleted_at IS NULL AND p.status = 'published'
        AND p.customisation_enabled = true AND p.customisation_profile_id IS NOT NULL
        AND pv.is_available = true
      ORDER BY p.updated_at DESC
      LIMIT 1
    `;
    if (!product) throw new Error("No published customisable product found.");
    report.product = {
      slug: product.slug,
      title: product.title,
      variant: product.variant_title,
      currency: product.currency_code
    };

    const customisation = {
      mode: "name_number" as const,
      name: "STRIPE TEST",
      number: "07",
      message: "TEST ORDER"
    };
    const resolved = await resolveCartCustomisationPricing(product.variant_id, customisation, url);

    await clearCart(SESSION, url);
    await addItemToCart(
      SESSION,
      product.variant_id,
      1,
      url,
      resolved.customisation,
      resolved.customisationPriceAmount
    );

    const checkout: GuestCheckoutInput = {
      email: `stripe.test+${Date.now()}@sjh-internal.test`,
      phone: "+15555550199",
      shippingAddress: {
        fullName: `${TEST_MARKER} Customer`,
        line1: "456 Stripe Test Ave",
        city: "Austin",
        region: "TX",
        postalCode: "78701",
        country: "US"
      },
      customerNotes: `${TEST_MARKER} — Stripe TEST MODE payment proof. Do not fulfil commercially.`
    };

    const order = await createOrderFromCart(SESSION, checkout, url);
    report.orderNumber = order.orderNumber;
    report.orderId = order.id;
    report.currency = order.currencyCode;
    report.totalAmount = order.totalAmount;

    const line = order.items[0];
    results.push({
      step: "order_pending_payment_with_customisation",
      ok:
        order.status === "pending_payment" &&
        line?.customisation.mode === "name_number" &&
        line.customisation.name === "STRIPE TEST" &&
        line.customisation.number === "07" &&
        line.customisation.message === "TEST ORDER",
      detail: { status: order.status, customisation: line?.customisation }
    });

    // --- Cancelled checkout path (separate order) ---
    const cancelSessionId = `${SESSION}-cancel`;
    await clearCart(cancelSessionId, url);
    await addItemToCart(
      cancelSessionId,
      product.variant_id,
      1,
      url,
      resolved.customisation,
      resolved.customisationPriceAmount
    );
    const cancelOrder = await createOrderFromCart(
      cancelSessionId,
      { ...checkout, email: `stripe.cancel+${Date.now()}@sjh-internal.test` },
      url
    );
    const cancelCheckout = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: cancelOrder.id,
      ...(cancelOrder.email ? { customer_email: cancelOrder.email } : {}),
      success_url: "https://example.com/success",
      cancel_url: "https://example.com/cancel",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: cancelOrder.currencyCode.toLowerCase(),
            unit_amount: amountToStripeCents(cancelOrder.totalAmount),
            product_data: { name: `Cancel test ${cancelOrder.orderNumber}` }
          }
        }
      ],
      metadata: {
        sjh_order_id: cancelOrder.id,
        sjh_order_number: cancelOrder.orderNumber
      }
    });
    await attachStripeCheckoutSession(
      { orderId: cancelOrder.id, checkoutSessionId: cancelCheckout.id },
      url
    );
    await stripe.checkout.sessions.expire(cancelCheckout.id);
    const cancelState = await getOrderPaymentState(cancelOrder.orderNumber, url);
    const cancelBatch = await createPurchaseOrderBatch(new Date().toISOString().slice(0, 10), url);
    const cancelPo = cancelBatch.created.some((po) =>
      po.lines.some((l) => l.orderNumber === cancelOrder.orderNumber)
    );
    results.push({
      step: "cancelled_checkout_no_paid_no_po",
      ok: cancelState?.status === "pending_payment" && !cancelPo,
      detail: {
        orderNumber: cancelOrder.orderNumber,
        status: cancelState?.status,
        sessionId: cancelCheckout.id,
        poCreated: cancelPo
      }
    });

    // --- Failed payment path ---
    const failSessionId = `${SESSION}-fail`;
    await clearCart(failSessionId, url);
    await addItemToCart(
      failSessionId,
      product.variant_id,
      1,
      url,
      resolved.customisation,
      resolved.customisationPriceAmount
    );
    const failOrder = await createOrderFromCart(
      failSessionId,
      { ...checkout, email: `stripe.fail+${Date.now()}@sjh-internal.test` },
      url
    );
    const failCheckout = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: failOrder.id,
      ...(failOrder.email ? { customer_email: failOrder.email } : {}),
      success_url: "https://example.com/success",
      cancel_url: "https://example.com/cancel",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: failOrder.currencyCode.toLowerCase(),
            unit_amount: amountToStripeCents(failOrder.totalAmount),
            product_data: { name: `Fail test ${failOrder.orderNumber}` }
          }
        }
      ],
      metadata: {
        sjh_order_id: failOrder.id,
        sjh_order_number: failOrder.orderNumber
      }
    });
    await attachStripeCheckoutSession(
      { orderId: failOrder.id, checkoutSessionId: failCheckout.id },
      url
    );
    let failConfirmError: string | null = null;
    try {
      await confirmTestCardPayment(stripe, {
        amountCents: amountToStripeCents(failOrder.totalAmount),
        currency: failOrder.currencyCode,
        orderId: failOrder.id,
        orderNumber: failOrder.orderNumber,
        checkoutSessionId: failCheckout.id,
        paymentMethod: "pm_card_chargeDeclined"
      });
    } catch (error) {
      failConfirmError = error instanceof Error ? error.message : "declined";
    }
    const failState = await getOrderPaymentState(failOrder.orderNumber, url);
    results.push({
      step: "failed_payment_remains_pending",
      ok: failState?.status === "pending_payment" && Boolean(failConfirmError),
      detail: {
        orderNumber: failOrder.orderNumber,
        status: failState?.status,
        confirmError: failConfirmError
      }
    });

    // --- Successful TEST payment ---
    const paidCheckout = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: order.id,
      ...(order.email ? { customer_email: order.email } : {}),
      success_url: "https://example.com/success",
      cancel_url: "https://example.com/cancel",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: order.currencyCode.toLowerCase(),
            unit_amount: amountToStripeCents(order.totalAmount),
            product_data: { name: `Sports Jersey House ${order.orderNumber}` }
          }
        }
      ],
      metadata: {
        sjh_order_id: order.id,
        sjh_order_number: order.orderNumber
      },
      payment_intent_data: {
        metadata: {
          sjh_order_id: order.id,
          sjh_order_number: order.orderNumber
        }
      }
    });
    await attachStripeCheckoutSession(
      { orderId: order.id, checkoutSessionId: paidCheckout.id },
      url
    );
    report.checkoutSessionId = paidCheckout.id;

    const confirmed = await confirmTestCardPayment(stripe, {
      amountCents: amountToStripeCents(order.totalAmount),
      currency: order.currencyCode,
      orderId: order.id,
      orderNumber: order.orderNumber,
      checkoutSessionId: paidCheckout.id,
      paymentMethod: "pm_card_visa"
    });
    report.paymentIntentId = confirmed.id;
    report.paymentIntentStatus = confirmed.status;

    results.push({
      step: "stripe_test_payment_confirmed",
      ok: confirmed.status === "succeeded",
      detail: { paymentIntentId: confirmed.id, status: confirmed.status }
    });

    const eventId = `evt_test_${Date.now()}`;
    const paidResult = await markOrderPaidFromStripe(
      {
        eventId,
        eventType: "checkout.session.completed",
        livemode: false,
        orderId: order.id,
        orderNumber: order.orderNumber,
        checkoutSessionId: paidCheckout.id,
        paymentIntentId: confirmed.id,
        paymentFeeAmount: "1.75",
        expectedAmountCents: amountToStripeCents(order.totalAmount),
        expectedCurrency: order.currencyCode
      },
      url
    );

    const paidState = await getOrderPaymentState(order.orderNumber, url);
    results.push({
      step: "webhook_marks_paid",
      ok: paidResult.newlyPaid && paidState?.status === "paid",
      detail: { paidResult, status: paidState?.status, paidAt: paidState?.paidAt }
    });

    const dup = await markOrderPaidFromStripe(
      {
        eventId,
        eventType: "checkout.session.completed",
        livemode: false,
        orderId: order.id,
        orderNumber: order.orderNumber,
        checkoutSessionId: paidCheckout.id,
        paymentIntentId: confirmed.id,
        expectedAmountCents: amountToStripeCents(order.totalAmount),
        expectedCurrency: order.currencyCode
      },
      url
    );
    const [eventCount] = await sql`
      SELECT count(*)::int AS n FROM stripe_webhook_events WHERE id = ${eventId}
    `;
    results.push({
      step: "duplicate_webhook_idempotent",
      ok: dup.duplicateEvent === true && eventCount?.n === 1 && paidState?.status === "paid",
      detail: { dup, eventCount: eventCount?.n }
    });

    const batch = await createPurchaseOrderBatch(new Date().toISOString().slice(0, 10), url);
    let poNumber =
      batch.created.find((po) => po.lines.some((l) => l.orderNumber === order.orderNumber))?.poNumber ??
      null;
    if (!poNumber) {
      const [existingPo] = await sql`
        SELECT po.po_number FROM purchase_orders po
        INNER JOIN order_items oi ON oi.purchase_order_id = po.id
        INNER JOIN orders o ON o.id = oi.order_id
        WHERE o.order_number = ${order.orderNumber}
        LIMIT 1
      `;
      poNumber = existingPo?.po_number ?? null;
    }
    report.poNumber = poNumber;
    results.push({
      step: "supplier_po_after_paid",
      ok: Boolean(poNumber),
      detail: { poNumber, created: batch.created.length }
    });

    if (!poNumber) throw new Error("PO was not created for paid order");

    const supplierUser = await getSupplierUserByEmail("supplier@sjh.local", url);
    if (!supplierUser) throw new Error("supplier@sjh.local missing");

    const detail = await getSupplierPurchaseOrderDetail(supplierUser.supplierId, poNumber, url);
    const hasCustom = detail.lines.some(
      (l) =>
        l.customisation.name?.toUpperCase() === "STRIPE TEST" &&
        l.customisation.number === "07" &&
        l.customisation.message === "TEST ORDER"
    );
    const leakingPrice = JSON.stringify(detail).match(/unitPrice|sellingPrice|marginPercent|totalAmount/i);
    results.push({
      step: "supplier_portal_customisation_no_sell_price",
      ok: hasCustom && !leakingPrice,
      detail: {
        lines: detail.lines.map((l) => ({
          product: l.productTitle,
          size: l.sizeLabel,
          customisation: l.customisation
        })),
        leakCheck: leakingPrice?.[0] ?? null
      }
    });

    await supplierAcknowledgePo(supplierUser.supplierId, supplierUser.id, poNumber, url);
    await supplierSubmitCost(
      supplierUser.supplierId,
      supplierUser.id,
      {
        poNumber,
        amount: "22.00",
        shippingCost: "5.00",
        notes: "Stripe TEST cost"
      },
      url
    );
    const orderItemId = detail.lines[0]?.id;
    if (!orderItemId) throw new Error("Missing order item on PO");
    await supplierSubmitTracking(
      supplierUser.supplierId,
      supplierUser.id,
      {
        poNumber,
        orderItemId,
        trackingNumber: `TESTSTRIPE${Date.now()}`,
        courier: "UPS"
      },
      url
    );

    const margins = await getOrderMargins(order.orderNumber, url);
    report.margin = margins;
    results.push({
      step: "margin_after_supplier_cost",
      ok: Boolean(margins) && Number.parseFloat(margins!.totals.totalCostAmount) >= 22,
      detail: margins?.totals
    });

    const allOk = results.every((r) => r.ok);
    console.log(JSON.stringify({ ok: allOk, report, results }, null, 2));
    process.exit(allOk ? 0 : 1);
  } catch (error) {
    console.error(JSON.stringify({ ok: false, report, results, error: String(error) }, null, 2));
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

void main();
