import { getSearchProvider } from "./search";
import { featureFlags } from "./env";

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
    publishableKeyConfigured: boolean;
    publishableKeyIsTest: boolean;
    publishableKeyIsLive: boolean;
    webhookSecretConfigured: boolean;
    appUrl: string | null;
    appUrlOk: boolean;
    readyForTestCheckout: boolean;
  };
};

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
    publishableKeyConfigured: Boolean(publishableKey),
    publishableKeyIsTest,
    publishableKeyIsLive,
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

  return {
    status: database.configured && !database.reachable ? "degraded" : "ok",
    environment: process.env.NODE_ENV ?? "development",
    database,
    shopifySyncEnabled: featureFlags.enableShopifySync,
    aiShoppingAssistantEnabled: featureFlags.enableAiShoppingAssistant,
    stripe: stripeRuntimeStatus()
  };
}
