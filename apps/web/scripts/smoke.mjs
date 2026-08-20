#!/usr/bin/env node
import { createSearchProvider } from "@sjh/search";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("SMOKE FAIL: DATABASE_URL is not set");
    process.exit(1);
  }

  const search = createSearchProvider({ databaseUrl });
  const [products, collections, bears, facets] = await Promise.all([
    search.search({ query: "", limit: 8 }),
    search.listPublishedCollections(),
    search.search({ query: "bears", limit: 5 }),
    search.getCatalogueFacets()
  ]);

  const checks = {
    products: products.results.length,
    collections: collections.length,
    bearsHits: bears.results.length,
    facets: facets.length
  };

  console.log("SMOKE OK", checks);

  if (checks.products < 1 || checks.collections < 1 || checks.bearsHits < 1) {
    console.error("SMOKE FAIL: expected published catalogue + search hits");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("SMOKE FAIL", error instanceof Error ? error.message : error);
  process.exit(1);
});
