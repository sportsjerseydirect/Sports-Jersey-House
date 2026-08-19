import { describe, expect, it } from "vitest";
import { devCatalogProducts } from "./dev-catalog";
import { seedDevCatalog } from "./index";

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
