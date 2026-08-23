import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ShopifyClientCredentialsProvider,
  ShopifyReadOnlyClient,
  ShopifySyncDisabledError,
  fetchProductsPage,
  isShopifyReadAllowed,
  normalizeShopifyStoreDomain,
  parseShopifyConfig,
  testShopifyConnection
} from "./index";
import type { ShopifyConfig, ShopifyGraphqlClient, ShopifyGraphqlRequest } from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
});

function baseConfig(overrides: Partial<ShopifyConfig> = {}): ShopifyConfig {
  return {
    storeDomain: "sports-jersey-direct.myshopify.com",
    clientId: "client-id",
    clientSecret: "client-secret",
    enableShopifySync: false,
    enableShopifySampleImport: false,
    enableShopifyFullImport: false,
    ...overrides
  };
}

describe("shopify safety gate", () => {
  it("uses only the approved client credentials environment contract", () => {
    const config = parseShopifyConfig({
      SHOPIFY_STORE_DOMAIN: "sports-jersey-direct.myshopify.com",
      SHOPIFY_CLIENT_ID: "client-id",
      SHOPIFY_CLIENT_SECRET: "client-secret",
      ENABLE_SHOPIFY_SYNC: "false",
      ENABLE_SHOPIFY_SAMPLE_IMPORT: "false"
    });

    expect(config).toEqual({
      storeDomain: "sports-jersey-direct.myshopify.com",
      clientId: "client-id",
      clientSecret: "client-secret",
      enableShopifySync: false,
      enableShopifySampleImport: false,
      enableShopifyFullImport: false
    });
  });

  it("parses ENABLE_SHOPIFY_SAMPLE_IMPORT without enabling full sync", () => {
    const config = parseShopifyConfig({
      SHOPIFY_STORE_DOMAIN: "sports-jersey-direct.myshopify.com",
      SHOPIFY_CLIENT_ID: "client-id",
      SHOPIFY_CLIENT_SECRET: "client-secret",
      ENABLE_SHOPIFY_SYNC: "false",
      ENABLE_SHOPIFY_SAMPLE_IMPORT: "true"
    });

    expect(config.enableShopifySampleImport).toBe(true);
    expect(config.enableShopifySync).toBe(false);
    expect(isShopifyReadAllowed(config)).toBe(true);
  });

  it("blocks token exchange while both gates are disabled", async () => {
    const provider = new ShopifyClientCredentialsProvider(baseConfig());

    await expect(provider.getAccessToken()).rejects.toBeInstanceOf(ShopifySyncDisabledError);
  });

  it("allows token exchange when sample import gate is enabled", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(
        JSON.stringify({
          access_token: "temporary-token",
          scope: "read_products",
          expires_in: 86_399
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ShopifyClientCredentialsProvider(
      baseConfig({ enableShopifySampleImport: true })
    );

    const token = await provider.getAccessToken();
    expect(token.accessToken).toBe("temporary-token");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("normalizes store names to myshopify domains", () => {
    expect(normalizeShopifyStoreDomain("sports-jersey-direct")).toBe("sports-jersey-direct.myshopify.com");
    expect(normalizeShopifyStoreDomain("https://sports-jersey-direct.myshopify.com/")).toBe(
      "sports-jersey-direct.myshopify.com"
    );
  });

  it("exchanges client credentials only when sync is enabled", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(
        JSON.stringify({
          access_token: "temporary-token",
          scope: "read_products",
          expires_in: 86_399
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ShopifyClientCredentialsProvider(baseConfig({ enableShopifySync: true }));

    const token = await provider.getAccessToken();

    expect(token.accessToken).toBe("temporary-token");
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];

    if (!call) {
      throw new Error("Expected Shopify token fetch to be called.");
    }

    const [url, init] = call;

    expect(url).toBe("https://sports-jersey-direct.myshopify.com/admin/oauth/access_token");
    expect(String(init?.body)).toContain("grant_type=client_credentials");
  });

  it("builds paginated product extraction requests", async () => {
    const requests: ShopifyGraphqlRequest[] = [];
    const client: ShopifyGraphqlClient = {
      async graphql<TResponse>(request: ShopifyGraphqlRequest): Promise<TResponse> {
        requests.push(request);

        return {
          products: {
            edges: [],
            pageInfo: {
              hasNextPage: false,
              endCursor: null
            }
          }
        } as TResponse;
      }
    };

    const response = await fetchProductsPage(client, { cursor: "cursor-1" }, 25);

    expect(requests[0]).toEqual(
      expect.objectContaining({
        variables: {
          first: 25,
          after: "cursor-1"
        }
      })
    );
    expect(response.products.pageInfo.hasNextPage).toBe(false);
  });

  it("testShopifyConnection returns gated failure without calling Shopify when both gates are off", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const result = await testShopifyConnection(baseConfig());

    expect(result.ok).toBe(false);
    expect(result.message).toContain("ENABLE_SHOPIFY_SAMPLE_IMPORT");
    expect(result.message).toContain("ENABLE_SHOPIFY_SYNC");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("testShopifyConnection succeeds with mocked GraphQL when sample gate is on", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("/admin/oauth/access_token")) {
        return new Response(
          JSON.stringify({
            access_token: "temporary-token",
            expires_in: 86_399
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          data: {
            shop: {
              name: "Sports Jersey Direct",
              primaryDomain: { url: "https://sportsjerseydirect.com" }
            }
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await testShopifyConnection(baseConfig({ enableShopifySampleImport: true }));

    expect(result.ok).toBe(true);
    expect(result.shopName).toBe("Sports Jersey Direct");
    expect(result.domain).toBe("https://sportsjerseydirect.com");
  });

  it("ShopifyReadOnlyClient graphql throws when neither gate is enabled", async () => {
    const client = new ShopifyReadOnlyClient(baseConfig());
    await expect(
      client.graphql({ query: "{ shop { name } }" })
    ).rejects.toBeInstanceOf(ShopifySyncDisabledError);
  });
});
