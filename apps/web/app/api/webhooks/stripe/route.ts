import {
  createStripeClient,
  resolveStripeWebhookSigningSecrets,
  retrievePaymentFeeAmount
} from "@/lib/stripe";
import {
  applyStripePaymentFeeIfMissing,
  markOrderPaidFromStripe,
  recordStripePaymentFailure
} from "@sjh/database";
import type Stripe from "stripe";

export const runtime = "nodejs";

/** Exists so deploy/health checks can confirm the webhook route is live. */
export async function GET() {
  return Response.json({
    ok: true,
    endpoint: "/api/webhooks/stripe",
    accepts: ["POST"],
    mode: "test_only"
  });
}

function sessionIds(session: Stripe.Checkout.Session): {
  orderId: string | null;
  orderNumber: string | null;
  checkoutSessionId: string;
  paymentIntentId: string | null;
  amountTotal: number | null;
  currency: string | null;
} {
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  return {
    orderId: session.metadata?.sjh_order_id ?? session.client_reference_id ?? null,
    orderNumber: session.metadata?.sjh_order_number ?? null,
    checkoutSessionId: session.id,
    paymentIntentId,
    amountTotal: session.amount_total,
    currency: session.currency
  };
}

async function fulfillPaidSession(
  event: Stripe.Event,
  session: Stripe.Checkout.Session
): Promise<Response> {
  if (session.payment_status === "unpaid") {
    return Response.json({ received: true, ignored: "unpaid" });
  }

  const ids = sessionIds(session);
  const stripe = createStripeClient();
  const paymentFeeAmount = await retrievePaymentFeeAmount(stripe, ids.paymentIntentId);

  const result = await markOrderPaidFromStripe({
    eventId: event.id,
    eventType: event.type,
    livemode: event.livemode,
    orderId: ids.orderId,
    orderNumber: ids.orderNumber,
    checkoutSessionId: ids.checkoutSessionId,
    paymentIntentId: ids.paymentIntentId,
    paymentFeeAmount,
    expectedAmountCents: ids.amountTotal,
    expectedCurrency: ids.currency
  });

  return Response.json({ received: true, result });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const payload = await request.text();
  const stripe = createStripeClient();
  const secrets = await resolveStripeWebhookSigningSecrets();
  if (secrets.length === 0) {
    return Response.json(
      { error: "Stripe webhook signing secret is not configured." },
      { status: 503 }
    );
  }

  let event: Stripe.Event | undefined;
  let lastError: unknown;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(payload, signature, secret);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!event) {
    const message = lastError instanceof Error ? lastError.message : "Invalid signature";
    return Response.json({ error: message }, { status: 400 });
  }

  if (event.livemode) {
    return Response.json(
      { error: "Live-mode Stripe webhooks are rejected. TEST MODE only." },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        return await fulfillPaidSession(event, session);
      }
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        return await fulfillPaidSession(event, session);
      }
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const ids = sessionIds(session);
        const result = await recordStripePaymentFailure({
          eventId: event.id,
          eventType: event.type,
          livemode: event.livemode,
          checkoutSessionId: ids.checkoutSessionId,
          paymentIntentId: ids.paymentIntentId,
          orderId: ids.orderId,
          orderNumber: ids.orderNumber
        });
        return Response.json({ received: true, result });
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const ids = sessionIds(session);
        const result = await recordStripePaymentFailure({
          eventId: event.id,
          eventType: event.type,
          livemode: event.livemode,
          checkoutSessionId: ids.checkoutSessionId,
          paymentIntentId: ids.paymentIntentId,
          orderId: ids.orderId,
          orderNumber: ids.orderNumber
        });
        return Response.json({ received: true, result });
      }
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const stripe = createStripeClient();
        const paymentFeeAmount = await retrievePaymentFeeAmount(stripe, paymentIntent.id);
        const result = await applyStripePaymentFeeIfMissing({
          eventId: event.id,
          eventType: event.type,
          livemode: event.livemode,
          paymentIntentId: paymentIntent.id,
          paymentFeeAmount,
          orderId: paymentIntent.metadata?.sjh_order_id ?? null,
          orderNumber: paymentIntent.metadata?.sjh_order_number ?? null
        });
        return Response.json({ received: true, result });
      }
      default:
        return Response.json({ received: true, ignored: event.type });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    console.error("[stripe.webhook]", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
