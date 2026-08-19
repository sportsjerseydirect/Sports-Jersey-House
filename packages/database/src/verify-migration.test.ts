import { describe, expect, it } from "vitest";
import { verifyMigration } from "./verify-migration";

const databaseUrl = process.env.DATABASE_URL;
const describeIfDatabase = databaseUrl ? describe : describe.skip;

describeIfDatabase("verifyMigration integration", () => {
  it("confirms pgvector migration is applied", async () => {
    const result = await verifyMigration(databaseUrl!);

    expect(result.ok).toBe(true);
    expect(result.extensions).toContain("vector");
    expect(result.tables).toContain("products");
    expect(result.productColumns.some((column) => column.columnName === "search_vector")).toBe(true);
    expect(result.productColumns.some((column) => column.columnName === "embedding")).toBe(true);
  });
});

describe("verifyMigration guard", () => {
  it("rejects invalid connection strings", async () => {
    await expect(verifyMigration("not-a-valid-database-url")).rejects.toThrow();
  });
});
