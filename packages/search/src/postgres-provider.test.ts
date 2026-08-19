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
});
