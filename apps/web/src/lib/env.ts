import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_NAME: z.string().default("Sports Jersey House"),
  ENABLE_AI_SHOPPING_ASSISTANT: z.enum(["true", "false"]).default("false"),
  ENABLE_SHOPIFY_SYNC: z.enum(["true", "false"]).default("false"),
  ENABLE_STRIPE_PAYMENTS: z.enum(["true", "false"]).default("false")
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  APP_URL: process.env.APP_URL,
  APP_NAME: process.env.APP_NAME,
  ENABLE_AI_SHOPPING_ASSISTANT: process.env.ENABLE_AI_SHOPPING_ASSISTANT,
  ENABLE_SHOPIFY_SYNC: process.env.ENABLE_SHOPIFY_SYNC,
  ENABLE_STRIPE_PAYMENTS: process.env.ENABLE_STRIPE_PAYMENTS
});

export const featureFlags = {
  enableAiShoppingAssistant: env.ENABLE_AI_SHOPPING_ASSISTANT === "true",
  enableShopifySync: env.ENABLE_SHOPIFY_SYNC === "true",
  enableStripePayments: env.ENABLE_STRIPE_PAYMENTS === "true"
};
