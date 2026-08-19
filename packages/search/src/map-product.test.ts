import { describe, expect, it } from "vitest";
import { mapProductToSummary } from "./map-product";

describe("mapProductToSummary", () => {
  it("maps database rows into shared product summaries", () => {
    const summary = mapProductToSummary({
      id: "00000000-0000-4000-8000-000000000001",
      shopifyId: null,
      slug: "chicago-bears-classic-home-jersey",
      title: "Chicago Bears Classic Home Jersey",
      description: "Dev catalogue jersey",
      vendor: "Sports Jersey House Dev",
      productType: "Jersey",
      sport: "Football",
      league: "NFL",
      team: "Chicago Bears",
      status: "published",
      sourcePayload: { seedTag: "dev-catalog-v1" },
      embedding: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "dev-seed",
      updatedBy: "dev-seed",
      deletedAt: null,
      variants: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          productId: "00000000-0000-4000-8000-000000000001",
          shopifyId: null,
          sku: "DEV-BEARS-HOME-M",
          title: "Medium",
          priceAmount: "129.99",
          currencyCode: "USD",
          inventoryQuantity: 25,
          isAvailable: true,
          options: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: "dev-seed",
          updatedBy: "dev-seed",
          deletedAt: null
        }
      ],
      primaryImageUrl: "http://localhost:3000/dev/jersey-placeholder.svg"
    });

    expect(summary.slug).toBe("chicago-bears-classic-home-jersey");
    expect(summary.price).toEqual({ amount: "129.99", currencyCode: "USD" });
    expect(summary.primaryImageUrl).toBe("http://localhost:3000/dev/jersey-placeholder.svg");
  });
});
