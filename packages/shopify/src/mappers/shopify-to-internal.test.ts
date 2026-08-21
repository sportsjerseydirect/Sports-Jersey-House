import { describe, expect, it } from "vitest";
import { mapShopifyProductForSampleImport, mapShopifyProductToInternal } from "./shopify-to-internal";
import type { ShopifyProductNode } from "../index";

function createSampleProduct(overrides: Partial<ShopifyProductNode> = {}): ShopifyProductNode {
  return {
    id: "gid://shopify/Product/123",
    handle: "chicago-bears-home-jersey",
    title: "Chicago Bears Home Jersey",
    descriptionHtml: "<p>Official-style home jersey with <strong>HTML</strong>.</p>",
    vendor: "Sports Jersey Direct",
    productType: "Jersey",
    status: "ACTIVE",
    tags: ["NFL", "Chicago Bears", "personalise"],
    updatedAt: "2026-01-01T00:00:00Z",
    seo: {
      title: "Chicago Bears SEO Title",
      description: "SEO description from SJD"
    },
    metafields: {
      edges: [
        {
          cursor: "m1",
          node: {
            id: "gid://shopify/Metafield/1",
            namespace: "custom",
            key: "name_number",
            value: "true",
            type: "boolean"
          }
        }
      ],
      pageInfo: { hasNextPage: false, endCursor: null }
    },
    collections: {
      edges: [
        {
          cursor: "c1",
          node: {
            id: "gid://shopify/Collection/9",
            handle: "nfl",
            title: "NFL"
          }
        }
      ],
      pageInfo: { hasNextPage: false, endCursor: null }
    },
    variants: {
      edges: [
        {
          cursor: "v1",
          node: {
            id: "gid://shopify/ProductVariant/456",
            title: "Medium",
            sku: "BEARS-M",
            price: { amount: "129.99", currencyCode: "USD" },
            compareAtPrice: { amount: "149.99", currencyCode: "USD" },
            inventoryQuantity: 10,
            availableForSale: true,
            selectedOptions: [{ name: "Size", value: "Medium" }]
          }
        }
      ],
      pageInfo: { hasNextPage: false, endCursor: null }
    },
    images: {
      edges: [
        {
          cursor: "i1",
          node: {
            id: "gid://shopify/ProductImage/789",
            url: "https://cdn.shopify.com/image.jpg",
            altText: "Chicago Bears jersey",
            width: 800,
            height: 800
          }
        }
      ],
      pageInfo: { hasNextPage: false, endCursor: null }
    },
    ...overrides
  };
}

describe("mapShopifyProductToInternal", () => {
  it("maps core product fields and infers NFL taxonomy from tags", () => {
    const draft = mapShopifyProductToInternal(createSampleProduct());

    expect(draft.shopifyId).toBe("gid://shopify/Product/123");
    expect(draft.slug).toBe("chicago-bears-home-jersey");
    expect(draft.status).toBe("draft");
    expect(draft.sport).toBe("Football");
    expect(draft.league).toBe("NFL");
    expect(draft.description).toBe("Official-style home jersey with HTML .");
  });

  it("maps variants and images including compareAtAmount", () => {
    const draft = mapShopifyProductToInternal(createSampleProduct());

    expect(draft.variants).toHaveLength(1);
    expect(draft.variants[0]?.priceAmount).toBe("129.99");
    expect(draft.variants[0]?.compareAtAmount).toBe("149.99");
    expect(draft.variants[0]?.isAvailable).toBe(true);
    expect(draft.images[0]?.sourceUrl).toBe("https://cdn.shopify.com/image.jpg");
  });

  it("maps archived Shopify status to archived internal status", () => {
    const draft = mapShopifyProductToInternal(createSampleProduct({ status: "ARCHIVED" }));

    expect(draft.status).toBe("archived");
  });
});

describe("mapShopifyProductForSampleImport", () => {
  it("does not copy SJD descriptionHtml into products.description", () => {
    const draft = mapShopifyProductForSampleImport(createSampleProduct());

    expect(draft.description).toBe(
      "Chicago Bears Home Jersey (imported draft — content pending review)"
    );
    expect(draft.description).not.toContain("Official-style");
    expect(draft.description).not.toContain("<p>");
    expect(draft.status).toBe("draft");
    expect(draft.status).not.toBe("published");
  });

  it("stores original source content in sourcePayload only", () => {
    const draft = mapShopifyProductForSampleImport(createSampleProduct());

    expect(draft.sourcePayload.origin).toBe("shopify-sample-import");
    expect(draft.sourcePayload.descriptionHtml).toContain("<p>Official-style");
    expect(draft.sourcePayload.seo).toEqual({
      title: "Chicago Bears SEO Title",
      description: "SEO description from SJD"
    });
    expect(draft.sourcePayload.metafields).toEqual([
      {
        id: "gid://shopify/Metafield/1",
        namespace: "custom",
        key: "name_number",
        value: "true",
        type: "boolean"
      }
    ]);
    expect(draft.sourcePayload.collections).toEqual([
      {
        id: "gid://shopify/Collection/9",
        handle: "nfl",
        title: "NFL"
      }
    ]);
    expect(draft.sourcePayload.customizationHints).toMatchObject({
      personalizationLikely: true
    });
  });
});
