import { z } from "zod";

export const shopifyConfigSchema = z.object({
  storeDomain: z.string().min(1),
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
  expiresAt?: Date;
};

export type ShopifyTokenProvider = {
  getAccessToken(): Promise<ShopifyTokenResponse>;
};

export class ShopifyClientCredentialsProvider implements ShopifyTokenProvider {
  constructor(private readonly config: ShopifyConfig) {}

  async getAccessToken(): Promise<ShopifyTokenResponse> {
    if (!this.config.enableShopifySync) {
      throw new ShopifySyncDisabledError();
    }

    throw new Error(
      "Shopify client-credentials exchange is intentionally not implemented until credentials and migration approval are provided."
    );
  }
}

export class ShopifyReadOnlyClient {
  constructor(
    private readonly config: ShopifyConfig,
    private readonly tokenProvider: ShopifyTokenProvider = new ShopifyClientCredentialsProvider(config)
  ) {}

  async graphql<TResponse>(_request: ShopifyGraphqlRequest): Promise<TResponse> {
    void _request;

    if (!this.config.enableShopifySync) {
      throw new ShopifySyncDisabledError();
    }

    await this.tokenProvider.getAccessToken();
    throw new Error("Shopify GraphQL read-only transport requires approved credentials before use.");
  }
}

export function parseShopifyConfig(env: NodeJS.ProcessEnv): ShopifyConfig {
  return shopifyConfigSchema.parse({
    storeDomain: env.SHOPIFY_STORE_DOMAIN,
    clientId: env.SHOPIFY_CLIENT_ID,
    clientSecret: env.SHOPIFY_CLIENT_SECRET,
    enableShopifySync: env.ENABLE_SHOPIFY_SYNC === "true"
  });
}
