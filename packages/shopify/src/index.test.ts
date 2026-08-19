import { describe, expect, it } from "vitest";
import { ShopifyClientCredentialsProvider, ShopifySyncDisabledError, parseShopifyConfig } from "./index";

describe("shopify safety gate", () => {
  it("uses only the approved client credentials environment contract", () => {
    const config = parseShopifyConfig({
      SHOPIFY_STORE_DOMAIN: "sports-jersey-direct.myshopify.com",
      SHOPIFY_CLIENT_ID: "client-id",
      SHOPIFY_CLIENT_SECRET: "client-secret",
      ENABLE_SHOPIFY_SYNC: "false"
    });

    expect(config).toEqual({
      storeDomain: "sports-jersey-direct.myshopify.com",
      clientId: "client-id",
      clientSecret: "client-secret",
      enableShopifySync: false
    });
  });

  it("blocks token exchange while sync is disabled", async () => {
    const provider = new ShopifyClientCredentialsProvider({
      storeDomain: "sports-jersey-direct.myshopify.com",
      clientId: "client-id",
      clientSecret: "client-secret",
      enableShopifySync: false
    });

    await expect(provider.getAccessToken()).rejects.toBeInstanceOf(ShopifySyncDisabledError);
  });
});
