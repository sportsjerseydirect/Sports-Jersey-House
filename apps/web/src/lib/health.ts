import { createSearchProvider } from "./search";
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
};

export async function buildHealthPayload(): Promise<HealthPayload> {
  const databaseUrl = process.env.DATABASE_URL;
  const database = {
    configured: Boolean(databaseUrl),
    reachable: false
  };

  if (databaseUrl) {
    try {
      const provider = createSearchProvider({ databaseUrl });
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
    aiShoppingAssistantEnabled: featureFlags.enableAiShoppingAssistant
  };
}
