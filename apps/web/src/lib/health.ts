import { featureFlags } from "./env";

export type HealthPayload = {
  status: "ok";
  environment: string;
  databaseConfigured: boolean;
  shopifySyncEnabled: boolean;
  aiShoppingAssistantEnabled: boolean;
};

export function buildHealthPayload(): HealthPayload {
  return {
    status: "ok",
    environment: process.env.NODE_ENV ?? "development",
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    shopifySyncEnabled: featureFlags.enableShopifySync,
    aiShoppingAssistantEnabled: featureFlags.enableAiShoppingAssistant
  };
}
