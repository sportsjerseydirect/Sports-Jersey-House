import { eq } from "drizzle-orm";
import { createDatabaseClient } from "./client";
import { stripeRuntimeConfig } from "./schema-commerce";

const CONFIG_ID = "default";

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for Stripe runtime config.");
  }
  return url;
}

export async function getStoredStripeWebhookSigningSecret(
  databaseUrl?: string
): Promise<string | null> {
  try {
    const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
    const [row] = await db
      .select({ webhookSigningSecret: stripeRuntimeConfig.webhookSigningSecret })
      .from(stripeRuntimeConfig)
      .where(eq(stripeRuntimeConfig.id, CONFIG_ID))
      .limit(1);
    const secret = row?.webhookSigningSecret?.trim();
    return secret || null;
  } catch {
    // Table may not exist yet during rollout.
    return null;
  }
}

export async function upsertStripeWebhookRuntimeConfig(
  input: {
    webhookEndpointId: string;
    webhookEndpointUrl: string;
    webhookSigningSecret?: string | null;
  },
  databaseUrl?: string
): Promise<void> {
  try {
    const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
    const now = new Date();
    const existingSecret = await getStoredStripeWebhookSigningSecret(databaseUrl);
    const nextSecret =
      input.webhookSigningSecret?.trim() || existingSecret || null;

    await db
      .insert(stripeRuntimeConfig)
      .values({
        id: CONFIG_ID,
        webhookEndpointId: input.webhookEndpointId,
        webhookEndpointUrl: input.webhookEndpointUrl,
        webhookSigningSecret: nextSecret,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: stripeRuntimeConfig.id,
        set: {
          webhookEndpointId: input.webhookEndpointId,
          webhookEndpointUrl: input.webhookEndpointUrl,
          ...(input.webhookSigningSecret?.trim()
            ? { webhookSigningSecret: input.webhookSigningSecret.trim() }
            : {}),
          updatedAt: now
        }
      });
  } catch (error) {
    console.error("[stripe.runtime_config] upsert failed", error instanceof Error ? error.name : "error");
  }
}
