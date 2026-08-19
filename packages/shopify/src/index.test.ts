import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ShopifyClientCredentialsProvider,
  ShopifySyncDisabledError,
  fetchProductsPage,
  normalizeShopifyStoreDomain,
  parseShopifyConfig
} from "./index";
import type { ShopifyGraphqlClient, ShopifyGraphqlRequest } from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

    const provider = new ShopifyClientCredentialsProvider({
      storeDomain: "sports-jersey-direct.myshopify.com",
      clientId: "client-id",
      clientSecret: "client-secret",
      enableShopifySync: true
    });

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
});
