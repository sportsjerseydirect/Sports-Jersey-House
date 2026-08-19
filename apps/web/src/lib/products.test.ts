import { describe, expect, it } from "vitest";
import {
  catalogueSummaryCount,
  formatProductPrice,
  hasCatalogueResults,
  productDetailPath
} from "./products";

describe("productDetailPath", () => {
  it("builds typed product detail routes", () => {
    expect(productDetailPath("chicago-bears-classic-home-jersey")).toBe(
      "/products/chicago-bears-classic-home-jersey"
    );
  });
});

describe("formatProductPrice", () => {
  it("formats USD amounts for product cards", () => {
    expect(formatProductPrice("129.99", "USD")).toBe("$129.99");
  });

  it("formats CAD amounts for product cards", () => {
    expect(formatProductPrice("149.99", "CAD")).toBe("CA$149.99");
  });
});

describe("catalogue helpers", () => {
  it("detects when search results can render the product grid", () => {
    expect(hasCatalogueResults({ results: [], facets: [] })).toBe(false);
    expect(
      hasCatalogueResults({
        results: [
          {
            product: {
              id: "00000000-0000-4000-8000-000000000001",
              slug: "chicago-bears-classic-home-jersey",
              title: "Chicago Bears Classic Home Jersey",
              status: "published"
            },
            score: 0.5,
            reasons: ["catalogue_listing"]
          }
        ],
        facets: []
      })
    ).toBe(true);
  });

  it("counts visible catalogue rows", () => {
    expect(catalogueSummaryCount({ results: [], facets: [] })).toBe(0);
    expect(
      catalogueSummaryCount({
        results: [
          {
            product: {
              id: "00000000-0000-4000-8000-000000000001",
              slug: "a",
              title: "A",
              status: "published"
            },
            score: 0.5,
            reasons: ["catalogue_listing"]
          },
          {
            product: {
              id: "00000000-0000-4000-8000-000000000002",
              slug: "b",
              title: "B",
              status: "published"
            },
            score: 0.5,
            reasons: ["catalogue_listing"]
          }
        ],
        facets: []
      })
    ).toBe(2);
  });
});
