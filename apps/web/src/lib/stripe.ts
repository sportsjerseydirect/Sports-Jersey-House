import { randomBytes } from "node:crypto";
import { Stripe } from "stripe";
import {
  amountToStripeCents,
  attachStripeCheckoutSession,
  getStoredStripeWebhookSigningSecret,
  upsertStripeWebhookRuntimeConfig,
  type OrderSnapshot
} from "@sjh/database";

const STRIPE_API_VERSION = "2026-07-29.dahlia" as const;

export const REQUIRED_STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired"
] as const;

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

/** Deduplicate env + stored TEST webhook signing secrets. Never returns live secrets. */
export function collectWebhookSigningSecrets(
  envSecret: string | undefined | null,
  storedSecret: string | undefined | null
): string[] {
  const secrets: string[] = [];
  for (const value of [envSecret, storedSecret]) {
    const secret = value?.trim();
    if (!secret || secret.includes("_live_")) continue;
    if (!secrets.includes(secret)) secrets.push(secret);
  }
  return secrets;
}

export async function resolveStripeWebhookSigningSecrets(): Promise<string[]> {
  const stored = await getStoredStripeWebhookSigningSecret().catch(() => null);
  return collectWebhookSigningSecrets(process.env.STRIPE_WEBHOOK_SECRET, stored);
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

function webhookTargetUrl(): string {
  return `${appBaseUrl()}/api/webhooks/stripe`;
}

function normalizeWebhookUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

function integrationIdentifier(): string {
  return `sjh_checkout_${randomBytes(4).toString("hex")}`;
}

export type CreatedCheckoutSession = {
  sessionId: string;
  url: string;
};

export type StripeWebhookEndpointProbe = {
  inspected: boolean;
  matchedUrl: boolean;
  created: boolean;
  updated: boolean;
  status: string | null;
  missingEvents: string[];
  enabledEventCount: number;
  recentCheckoutCompletedEvents: number;
  error?: string;
};

let ensureWebhookPromise: Promise<StripeWebhookEndpointProbe> | null = null;

export async function inspectStripeWebhookEndpoint(): Promise<StripeWebhookEndpointProbe> {
  try {
    const stripe = createStripeClient();
    const target = normalizeWebhookUrl(webhookTargetUrl());
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const match = endpoints.data.find((endpoint) => normalizeWebhookUrl(endpoint.url) === target) ?? null;
    const events = await stripe.events.list({
      type: "checkout.session.completed",
      limit: 10
    });
    const missing = match
      ? REQUIRED_STRIPE_WEBHOOK_EVENTS.filter(
          (eventName) =>
            !match.enabled_events.includes(eventName) && !match.enabled_events.includes("*")
        )
      : [...REQUIRED_STRIPE_WEBHOOK_EVENTS];

    return {
      inspected: true,
      matchedUrl: Boolean(match),
      created: false,
      updated: false,
      status: match?.status ?? null,
      missingEvents: [...missing],
      enabledEventCount: match?.enabled_events.length ?? 0,
      recentCheckoutCompletedEvents: events.data.filter((event) => !event.livemode).length
    };
  } catch (error) {
    return {
      inspected: false,
      matchedUrl: false,
      created: false,
      updated: false,
      status: null,
      missingEvents: [...REQUIRED_STRIPE_WEBHOOK_EVENTS],
      enabledEventCount: 0,
      recentCheckoutCompletedEvents: 0,
      error: error instanceof Error ? error.name : "inspect_failed"
    };
  }
}

/**
 * Ensure a TEST-mode webhook endpoint exists on the SAME Stripe account as STRIPE_SECRET_KEY.
 * Stores the signing secret when created so fulfillment works even if Vercel env still
 * holds a secret from a different sandbox/account.
 */
export async function ensureStripeWebhookEndpoint(): Promise<StripeWebhookEndpointProbe> {
  const stripe = createStripeClient();
  const target = normalizeWebhookUrl(webhookTargetUrl());
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const match = endpoints.data.find((endpoint) => normalizeWebhookUrl(endpoint.url) === target) ?? null;

  if (match) {
    const missing = REQUIRED_STRIPE_WEBHOOK_EVENTS.filter(
      (eventName) => !match.enabled_events.includes(eventName) && !match.enabled_events.includes("*")
    );
    let updated = false;
    if (missing.length > 0 || match.status !== "enabled") {
      const enabled_events = Array.from(
        new Set([
          ...match.enabled_events.filter((eventName) => eventName !== "*"),
          ...REQUIRED_STRIPE_WEBHOOK_EVENTS
        ])
      ) as NonNullable<Stripe.WebhookEndpointUpdateParams["enabled_events"]>;
      await stripe.webhookEndpoints.update(match.id, {
        enabled_events,
        disabled: false
      });
      updated = true;
    }

    await upsertStripeWebhookRuntimeConfig({
      webhookEndpointId: match.id,
      webhookEndpointUrl: match.url
    });

    return {
      inspected: true,
      matchedUrl: true,
      created: false,
      updated,
      status: "enabled",
      missingEvents: [],
      enabledEventCount: match.enabled_events.length + (updated ? missing.length : 0),
      recentCheckoutCompletedEvents: 0
    };
  }

  const created = await stripe.webhookEndpoints.create({
    url: target,
    enabled_events: [...REQUIRED_STRIPE_WEBHOOK_EVENTS],
    description: "Sports Jersey House production TEST checkout fulfillment",
    api_version: STRIPE_API_VERSION
  });

  await upsertStripeWebhookRuntimeConfig({
    webhookEndpointId: created.id,
    webhookEndpointUrl: created.url,
    webhookSigningSecret: created.secret ?? null
  });

  return {
    inspected: true,
    matchedUrl: true,
    created: true,
    updated: false,
    status: created.status ?? "enabled",
    missingEvents: [],
    enabledEventCount: REQUIRED_STRIPE_WEBHOOK_EVENTS.length,
    recentCheckoutCompletedEvents: 0
  };
}

export function ensureStripeWebhookEndpointOnce(): Promise<StripeWebhookEndpointProbe> {
  if (!ensureWebhookPromise) {
    ensureWebhookPromise = ensureStripeWebhookEndpoint().catch((error) => {
      ensureWebhookPromise = null;
      throw error;
    });
  }
  return ensureWebhookPromise;
}

export async function createCheckoutSessionForOrder(
  order: OrderSnapshot
): Promise<CreatedCheckoutSession> {
  if (!isStripePaymentsEnabled()) {
    throw new StripeTestModeRequiredError("ENABLE_STRIPE_PAYMENTS must be true.");
  }

  try {
    await ensureStripeWebhookEndpointOnce();
  } catch (error) {
    console.error(
      "[stripe.webhook.ensure]",
      error instanceof Error ? error.name : "ensure_failed"
    );
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
