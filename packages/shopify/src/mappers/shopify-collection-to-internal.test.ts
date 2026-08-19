import { describe, expect, it } from "vitest";
import { mapShopifyCollectionToInternal } from "./shopify-collection-to-internal";
import type { ShopifyCollectionNode } from "../index";

describe("mapShopifyCollectionToInternal", () => {
  it("maps collection metadata and product memberships", () => {
    const node: ShopifyCollectionNode = {
      id: "gid://shopify/Collection/1",
      handle: "nfl-jerseys",
      title: "NFL Jerseys",
      descriptionHtml: "<p>All NFL jerseys</p>",
      updatedAt: "2026-01-01T00:00:00Z",
      products: {
        edges: [{ cursor: "p1", node: { id: "gid://shopify/Product/10" } }],
        pageInfo: { hasNextPage: false, endCursor: null }
      }
    };

    const draft = mapShopifyCollectionToInternal(node);

    expect(draft.slug).toBe("nfl-jerseys");
    expect(draft.productShopifyIds).toEqual(["gid://shopify/Product/10"]);
    expect(draft.description).toBe("All NFL jerseys");
  });
});
