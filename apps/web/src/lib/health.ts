import { getSearchProvider } from "./search";
import { featureFlags } from "./env";
import {
  inspectStripeWebhookEndpoint,
  type StripeWebhookEndpointProbe
} from "./stripe";

export type HealthPayload = {
  status: "ok" | "degraded";
  environment: string;
  database: {
    configured: boolean;
    reachable: boolean;
  };
  shopifySyncEnabled: boolean;
  aiShoppingAssistantEnabled: boolean;
  stripe: {
    paymentsEnabled: boolean;
    secretKeyConfigured: boolean;
    secretKeyIsTest: boolean;
    secretKeyIsLive: boolean;
    secretKeyPrefix: "sk_test_" | "rk_test_" | "rkcs_test_" | "live_blocked" | "missing" | "unexpected";
    publishableKeyConfigured: boolean;
    publishableKeyIsTest: boolean;
    publishableKeyIsLive: boolean;
    publishableKeyPrefix: "pk_test_" | "live_blocked" | "missing" | "unexpected";
    webhookSecretConfigured: boolean;
    appUrl: string | null;
    appUrlOk: boolean;
    readyForTestCheckout: boolean;
    webhookEndpoint: StripeWebhookEndpointProbe | null;
  };
};

function secretKeyPrefix(
  secretKey: string
): HealthPayload["stripe"]["secretKeyPrefix"] {
  if (!secretKey) return "missing";
  if (secretKey.includes("_live_") || secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_")) {
    return "live_blocked";
  }
  if (secretKey.startsWith("sk_test_")) return "sk_test_";
  if (secretKey.startsWith("rk_test_")) return "rk_test_";
  if (secretKey.startsWith("rkcs_test_")) return "rkcs_test_";
  return "unexpected";
}

function publishableKeyPrefix(
  publishableKey: string
): HealthPayload["stripe"]["publishableKeyPrefix"] {
  if (!publishableKey) return "missing";
  if (publishableKey.startsWith("pk_live_") || publishableKey.includes("_live_")) {
    return "live_blocked";
  }
  if (publishableKey.startsWith("pk_test_")) return "pk_test_";
  return "unexpected";
}

function stripeRuntimeStatus() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  const appUrl = process.env.APP_URL?.trim() ?? null;
  const paymentsEnabled = featureFlags.enableStripePayments;

  const secretKeyIsLive =
    secretKey.includes("_live_") || secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_");
  const secretKeyIsTest =
    Boolean(secretKey) &&
    !secretKeyIsLive &&
    (secretKey.startsWith("sk_test_") ||
      secretKey.startsWith("rk_test_") ||
      secretKey.startsWith("rkcs_test_") ||
      /_(test)_/.test(secretKey));

  const publishableKeyIsLive = publishableKey.startsWith("pk_live_") || publishableKey.includes("_live_");
  const publishableKeyIsTest = publishableKey.startsWith("pk_test_") && !publishableKeyIsLive;

  const appUrlOk = (appUrl ?? "").replace(/\/$/, "") === "https://sports-jersey-house.vercel.app";

  return {
    paymentsEnabled,
    secretKeyConfigured: Boolean(secretKey),
    secretKeyIsTest,
    secretKeyIsLive,
    secretKeyPrefix: secretKeyPrefix(secretKey),
    publishableKeyConfigured: Boolean(publishableKey),
    publishableKeyIsTest,
    publishableKeyIsLive,
    publishableKeyPrefix: publishableKeyPrefix(publishableKey),
    webhookSecretConfigured: Boolean(webhookSecret),
    appUrl,
    appUrlOk,
    readyForTestCheckout:
      paymentsEnabled &&
      secretKeyIsTest &&
      !secretKeyIsLive &&
      publishableKeyIsTest &&
      !publishableKeyIsLive &&
      Boolean(webhookSecret) &&
      appUrlOk
  };
}

export async function buildHealthPayload(): Promise<HealthPayload> {
  const databaseUrl = process.env.DATABASE_URL;
  const database = {
    configured: Boolean(databaseUrl),
    reachable: false
  };

  if (databaseUrl) {
    try {
      const provider = getSearchProvider();
      await provider.listPublishedProductSlugs(1);
      database.reachable = true;
    } catch {
      database.reachable = false;
    }
  }

  const stripeBase = stripeRuntimeStatus();
  let webhookEndpoint: StripeWebhookEndpointProbe | null = null;
  if (stripeBase.paymentsEnabled && stripeBase.secretKeyIsTest && !stripeBase.secretKeyIsLive) {
    webhookEndpoint = await inspectStripeWebhookEndpoint();
  }

  return {
    status: database.configured && !database.reachable ? "degraded" : "ok",
    environment: process.env.NODE_ENV ?? "development",
    database,
    shopifySyncEnabled: featureFlags.enableShopifySync,
    aiShoppingAssistantEnabled: featureFlags.enableAiShoppingAssistant,
    stripe: {
      ...stripeBase,
      webhookEndpoint
    }
  };
}
