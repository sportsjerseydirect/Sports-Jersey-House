import { describe, expect, it } from "vitest";
import { devCatalogProducts } from "./dev-catalog";

describe("dev catalogue seed", () => {
  it("defines fake local products without Shopify identifiers", () => {
    expect(devCatalogProducts.length).toBeGreaterThanOrEqual(8);

    for (const product of devCatalogProducts) {
      expect(product.slug).toMatch(/^[a-z0-9-]+$/);
      expect(product.title.length).toBeGreaterThan(0);
      expect(product.priceAmount).toMatch(/^\d+\.\d{2}$/);
    }
  });
});
