import { extractionCheckpointSchema, type ExtractionCheckpoint } from "@sjh/shared";
import { z } from "zod";

export const SHOPIFY_ADMIN_API_VERSION = "2026-07";

export const shopifyConfigSchema = z.object({
  storeDomain: z.string().min(1).transform(normalizeShopifyStoreDomain),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  enableShopifySync: z.boolean().default(false)
});

export type ShopifyConfig = z.infer<typeof shopifyConfigSchema>;

export class ShopifySyncDisabledError extends Error {
  constructor() {
    super("Shopify sync is disabled. Set ENABLE_SHOPIFY_SYNC=true only after migration approval.");
    this.name = "ShopifySyncDisabledError";
  }
}

export type ShopifyGraphqlRequest = {
  query: string;
  variables?: Record<string, unknown>;
};

export type ShopifyTokenResponse = {
  accessToken: string;
  scope?: string;
  expiresAt?: Date;
};

export type ShopifyTokenProvider = {
  getAccessToken(): Promise<ShopifyTokenResponse>;
};

export type ShopifyGraphqlClient = {
  graphql<TResponse>(request: ShopifyGraphqlRequest): Promise<TResponse>;
};

const shopifyTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  scope: z.string().optional(),
  expires_in: z.number().int().positive().optional()
});

export class ShopifyClientCredentialsProvider implements ShopifyTokenProvider {
  private cachedToken?: ShopifyTokenResponse;

  constructor(private readonly config: ShopifyConfig) {}

  async getAccessToken(): Promise<ShopifyTokenResponse> {
    if (!this.config.enableShopifySync) {
      throw new ShopifySyncDisabledError();
    }

    if (this.cachedToken?.expiresAt && this.cachedToken.expiresAt.getTime() > Date.now() + 60_000) {
      return this.cachedToken;
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    });

    const response = await fetch(`https://${this.config.storeDomain}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    if (!response.ok) {
      throw new Error(`Shopify token exchange failed with HTTP ${response.status}.`);
    }

    const parsed = shopifyTokenResponseSchema.parse(await response.json());
    const expiresInMs = (parsed.expires_in ?? 86_399) * 1_000;

    const tokenResponse: ShopifyTokenResponse = {
      accessToken: parsed.access_token,
      expiresAt: new Date(Date.now() + expiresInMs)
    };

    if (parsed.scope) {
      tokenResponse.scope = parsed.scope;
    }

    this.cachedToken = tokenResponse;

    return tokenResponse;
  }
}

export class ShopifyReadOnlyClient implements ShopifyGraphqlClient {
  constructor(
    private readonly config: ShopifyConfig,
    private readonly tokenProvider: ShopifyTokenProvider = new ShopifyClientCredentialsProvider(config)
  ) {}

  async graphql<TResponse>(_request: ShopifyGraphqlRequest): Promise<TResponse> {
    if (!this.config.enableShopifySync) {
      throw new ShopifySyncDisabledError();
    }

    const token = await this.tokenProvider.getAccessToken();
    const response = await fetch(
      `https://${this.config.storeDomain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token.accessToken
        },
        body: JSON.stringify(_request)
      }
    );

    if (!response.ok) {
      throw new Error(`Shopify GraphQL request failed with HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as { data?: TResponse; errors?: unknown };

    if (payload.errors) {
      throw new Error("Shopify GraphQL returned errors.");
    }

    if (!payload.data) {
      throw new Error("Shopify GraphQL response did not include data.");
    }

    return payload.data;
  }
}

export type ShopifyPageInfo = {
  hasNextPage: boolean;
  endCursor: string | null;
};

export type ShopifyConnection<TNode> = {
  edges: Array<{
    cursor: string;
    node: TNode;
  }>;
  pageInfo: ShopifyPageInfo;
};

export type ShopifyVariantNode = {
  id: string;
  title: string;
  sku: string | null;
  price: {
    amount: string;
    currencyCode: string;
  };
  inventoryQuantity: number | null;
  availableForSale: boolean;
  selectedOptions: Array<{ name: string; value: string }>;
};

export type ShopifyImageNode = {
  id: string;
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
};

export type ShopifyProductNode = {
  id: string;
  handle: string;
  title: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  status: string;
  tags: string[];
  updatedAt: string;
  variants: ShopifyConnection<ShopifyVariantNode>;
  images: ShopifyConnection<ShopifyImageNode>;
};

export type ShopifyProductsResponse = {
  products: ShopifyConnection<ShopifyProductNode>;
};

export type ShopifyCollectionNode = {
  id: string;
  handle: string;
  title: string;
  descriptionHtml: string;
  updatedAt: string;
  products: ShopifyConnection<{ id: string }>;
};

export type ShopifyCollectionsResponse = {
  collections: ShopifyConnection<ShopifyCollectionNode>;
};

export const SHOPIFY_PRODUCTS_QUERY = `#graphql
  query ProductsPage($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: UPDATED_AT) {
      edges {
        cursor
        node {
          id
          handle
          title
          descriptionHtml
          vendor
          productType
          status
          tags
          updatedAt
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                price {
                  amount
                  currencyCode
                }
                inventoryQuantity
                availableForSale
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
          images(first: 20) {
            edges {
              node {
                id
                url
                altText
                width
                height
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export async function fetchProductsPage(
  client: ShopifyGraphqlClient,
  checkpoint: Pick<ExtractionCheckpoint, "cursor">,
  first = 100
): Promise<ShopifyProductsResponse> {
  return client.graphql<ShopifyProductsResponse>({
    query: SHOPIFY_PRODUCTS_QUERY,
    variables: {
      first,
      after: checkpoint.cursor
    }
  });
}

export const SHOPIFY_COLLECTIONS_QUERY = `#graphql
  query CollectionsPage($first: Int!, $after: String) {
    collections(first: $first, after: $after, sortKey: UPDATED_AT) {
      edges {
        cursor
        node {
          id
          handle
          title
          descriptionHtml
          updatedAt
          products(first: 250) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export async function fetchCollectionsPage(
  client: ShopifyGraphqlClient,
  checkpoint: Pick<ExtractionCheckpoint, "cursor">,
  first = 50
): Promise<ShopifyCollectionsResponse> {
  return client.graphql<ShopifyCollectionsResponse>({
    query: SHOPIFY_COLLECTIONS_QUERY,
    variables: {
      first,
      after: checkpoint.cursor
    }
  });
}

export function parseShopifyConfig(env: NodeJS.ProcessEnv): ShopifyConfig {
  return shopifyConfigSchema.parse({
    storeDomain: env.SHOPIFY_STORE_DOMAIN,
    clientId: env.SHOPIFY_CLIENT_ID,
    clientSecret: env.SHOPIFY_CLIENT_SECRET,
    enableShopifySync: env.ENABLE_SHOPIFY_SYNC === "true"
  });
}

export type { ExtractionCheckpoint };
export { extractionCheckpointSchema };

export { mapShopifyProductToInternal } from "./mappers/shopify-to-internal";
export type { InternalProductDraft } from "./mappers/shopify-to-internal";
export { upsertShopifyProducts } from "./load/upsert-products";
export type { UpsertProductsResult } from "./load/upsert-products";
export { extractProductsPage } from "./migration/products-extract";
export type { ExtractProductsPageOptions, ExtractProductsPageResult } from "./migration/products-extract";
export { extractAllProducts } from "./migration/extract-all-products";
export type { ExtractAllProductsOptions, ExtractAllProductsResult } from "./migration/extract-all-products";
export { extractCollectionsPage } from "./migration/collections-extract";
export type { ExtractCollectionsPageOptions, ExtractCollectionsPageResult } from "./migration/collections-extract";
export { extractAllCollections } from "./migration/extract-all-collections";
export type { ExtractAllCollectionsOptions, ExtractAllCollectionsResult } from "./migration/extract-all-collections";
export { mapShopifyCollectionToInternal } from "./mappers/shopify-collection-to-internal";
export type { InternalCollectionDraft } from "./mappers/shopify-collection-to-internal";
export { upsertShopifyCollections } from "./load/upsert-collections";
export type { UpsertCollectionsResult } from "./load/upsert-collections";

export function normalizeShopifyStoreDomain(value: string): string {
  const trimmed = value.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");

  if (!trimmed.endsWith(".myshopify.com")) {
    return `${trimmed}.myshopify.com`;
  }

  return trimmed;
}
