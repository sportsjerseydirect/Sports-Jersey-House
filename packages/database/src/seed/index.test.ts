import { describe, expect, it } from "vitest";
import { devCatalogProducts } from "./dev-catalog";
import { devCollections } from "./dev-collections";
import { seedDevCatalog, seedDevCollections } from "./index";

const databaseUrl = process.env.DATABASE_URL;
const describeIfDatabase = databaseUrl ? describe : describe.skip;

describeIfDatabase("seedDevCatalog integration", () => {
  it("inserts or skips the fake local dev catalogue", async () => {
    const result = await seedDevCatalog(databaseUrl!);

    expect(result.skipped || result.inserted === devCatalogProducts.length).toBe(true);

    const secondRun = await seedDevCatalog(databaseUrl!);
    expect(secondRun.skipped).toBe(true);
    expect(secondRun.inserted).toBe(0);
  });
});

describeIfDatabase("seedDevCollections integration", () => {
  it("inserts or skips fake local league collections", async () => {
    await seedDevCatalog(databaseUrl!);
    const result = await seedDevCollections(databaseUrl!);

    expect(result.skipped || result.inserted === devCollections.length).toBe(true);

    const secondRun = await seedDevCollections(databaseUrl!);
    expect(secondRun.skipped).toBe(true);
    expect(secondRun.inserted).toBe(0);
  });
});
