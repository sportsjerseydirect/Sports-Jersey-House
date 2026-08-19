import { describe, expect, it } from "vitest";
import { devCollections } from "./dev-collections";

describe("dev collections seed", () => {
  it("defines fake local collections without Shopify identifiers", () => {
    expect(devCollections.length).toBeGreaterThanOrEqual(3);

    for (const collection of devCollections) {
      expect(collection.slug).toMatch(/^[a-z0-9-]+$/);
      expect(collection.title.length).toBeGreaterThan(0);
      expect(collection.league.length).toBeGreaterThan(0);
    }
  });
});
