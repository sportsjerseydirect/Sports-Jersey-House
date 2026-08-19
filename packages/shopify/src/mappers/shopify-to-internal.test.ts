import { describe, expect, it } from "vitest";
import { mapShopifyProductToInternal } from "./shopify-to-internal";
import type { ShopifyProductNode } from "../index";

function createSampleProduct(overrides: Partial<ShopifyProductNode> = {}): ShopifyProductNode {
  return {
    id: "gid://shopify/Product/123",
    handle: "chicago-bears-home-jersey",
    title: "Chicago Bears Home Jersey",
    descriptionHtml: "<p>Official-style home jersey.</p>",
    vendor: "Sports Jersey Direct",
    productType: "Jersey",
    status: "ACTIVE",
    tags: ["NFL", "Chicago Bears"],
    updatedAt: "2026-01-01T00:00:00Z",
    variants: {
      edges: [
        {
          cursor: "v1",
          node: {
            id: "gid://shopify/ProductVariant/456",
            title: "Medium",
            sku: "BEARS-M",
            price: { amount: "129.99", currencyCode: "USD" },
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
    expect(draft.description).toBe("Official-style home jersey.");
  });

  it("maps variants and images", () => {
    const draft = mapShopifyProductToInternal(createSampleProduct());

    expect(draft.variants).toHaveLength(1);
    expect(draft.variants[0]?.priceAmount).toBe("129.99");
    expect(draft.variants[0]?.isAvailable).toBe(true);
    expect(draft.images[0]?.sourceUrl).toBe("https://cdn.shopify.com/image.jpg");
  });

  it("maps archived Shopify status to archived internal status", () => {
    const draft = mapShopifyProductToInternal(createSampleProduct({ status: "ARCHIVED" }));

    expect(draft.status).toBe("archived");
  });
});
