import { randomBytes } from "node:crypto";
import { Stripe } from "stripe";
import {
  amountToStripeCents,
  attachStripeCheckoutSession,
  type OrderSnapshot
} from "@sjh/database";

const STRIPE_API_VERSION = "2026-07-29.dahlia" as const;

export class StripeTestModeRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeTestModeRequiredError";
  }
}

export function isStripePaymentsEnabled(): boolean {
  return process.env.ENABLE_STRIPE_PAYMENTS === "true";
}

export function assertStripeTestSecretKey(secretKey: string): void {
  if (secretKey.includes("_live_") || secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_")) {
    throw new StripeTestModeRequiredError(
      "Live Stripe secret keys are blocked. Configure TEST keys only."
    );
  }
  const isTestKey =
    secretKey.startsWith("sk_test_") ||
    secretKey.startsWith("rk_test_") ||
    secretKey.startsWith("rkcs_test_") ||
    /_(test)_/.test(secretKey);
  if (!isTestKey) {
    throw new StripeTestModeRequiredError(
      "Stripe secret key must be a TEST key (sk_test_ / rk_test_ / rkcs_test_)."
    );
  }
}

export function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new StripeTestModeRequiredError("STRIPE_SECRET_KEY is not configured.");
  }
  assertStripeTestSecretKey(key);
  return key;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new StripeTestModeRequiredError("STRIPE_WEBHOOK_SECRET is not configured.");
  }
  if (secret.includes("_live_")) {
    throw new StripeTestModeRequiredError("Live webhook secrets are blocked. Use a TEST webhook signing secret.");
  }
  return secret;
}

export function createStripeClient(): Stripe {
  return new Stripe(getStripeSecretKey(), {
    apiVersion: STRIPE_API_VERSION,
    typescript: true
  });
}

function appBaseUrl(): string {
  const url = process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return url;
}

function integrationIdentifier(): string {
  return `sjh_checkout_${randomBytes(4).toString("hex")}`;
}

export type CreatedCheckoutSession = {
  sessionId: string;
  url: string;
};

export async function createCheckoutSessionForOrder(
  order: OrderSnapshot
): Promise<CreatedCheckoutSession> {
  if (!isStripePaymentsEnabled()) {
    throw new StripeTestModeRequiredError("ENABLE_STRIPE_PAYMENTS must be true.");
  }

  const stripe = createStripeClient();
  const amountCents = amountToStripeCents(order.totalAmount);
  if (amountCents < 50) {
    throw new Error("Order total is below Stripe minimum charge amount.");
  }

  const currency = order.currencyCode.toLowerCase();
  if (!["usd", "cad", "gbp"].includes(currency)) {
    throw new Error(`Unsupported checkout currency: ${order.currencyCode}`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: order.id,
    ...(order.email ? { customer_email: order.email } : {}),
    success_url: `${appBaseUrl()}/orders/${encodeURIComponent(order.orderNumber)}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appBaseUrl()}/orders/${encodeURIComponent(order.orderNumber)}?checkout=cancelled`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amountCents,
          product_data: {
            name: `Sports Jersey House ${order.orderNumber}`,
            description: "Made-to-order custom jersey order (details stored in SJH)"
          }
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
    },
    integration_identifier: integrationIdentifier()
  });

  if (!session.url) {
    throw new Error("Stripe Checkout Session did not return a URL.");
  }

  await attachStripeCheckoutSession({
    orderId: order.id,
    checkoutSessionId: session.id
  });

  return { sessionId: session.id, url: session.url };
}

export async function retrievePaymentFeeAmount(
  stripe: Stripe,
  paymentIntentId: string | null | undefined
): Promise<string | null> {
  if (!paymentIntentId) {
    return null;
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"]
  });

  const charge = paymentIntent.latest_charge;
  if (!charge || typeof charge === "string") {
    return null;
  }

  const balanceTransaction = charge.balance_transaction;
  if (!balanceTransaction || typeof balanceTransaction === "string") {
    return null;
  }

  return (balanceTransaction.fee / 100).toFixed(2);
}
