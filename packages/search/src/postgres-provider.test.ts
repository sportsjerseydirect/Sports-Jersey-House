import { describe, expect, it } from "vitest";
import { createPostgresSearchProvider } from "./postgres-provider";

const databaseUrl = process.env.DATABASE_URL;
const describeIfDatabase = databaseUrl ? describe : describe.skip;

describeIfDatabase("PostgresSearchProvider integration", () => {
  it("lists seeded dev catalogue products with empty query", async () => {
    const provider = createPostgresSearchProvider(databaseUrl!);
    const response = await provider.search({ query: "", limit: 24 });

    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results[0]?.product.title.length).toBeGreaterThan(0);
    expect(response.results[0]?.product.price).toBeDefined();
  });

  it("finds seeded products by league keyword", async () => {
    const provider = createPostgresSearchProvider(databaseUrl!);
    const response = await provider.search({ query: "NFL", limit: 24 });

    expect(response.results.some((result) => result.product.league === "NFL")).toBe(true);
  });

  it("loads a seeded product by slug", async () => {
    const provider = createPostgresSearchProvider(databaseUrl!);
    const product = await provider.getProductBySlug("chicago-bears-classic-home-jersey");

    expect(product?.title).toBe("Chicago Bears Classic Home Jersey");
    expect(product?.variants.length).toBeGreaterThan(0);
  });

  it("loads a seeded NFL collection with linked products", async () => {
    const provider = createPostgresSearchProvider(databaseUrl!);
    const collection = await provider.getCollectionBySlug("nfl-jerseys");

    expect(collection?.title).toBe("NFL Jerseys");
    expect(collection?.products.length).toBeGreaterThan(0);
  });

  it("returns catalogue facets for sport and league filters", async () => {
    const provider = createPostgresSearchProvider(databaseUrl!);
    const facets = await provider.getCatalogueFacets();

    expect(facets.some((facet) => facet.field === "league" && facet.value === "NFL")).toBe(true);
  });
});
