import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const foundationSql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../drizzle/0000_foundation.sql"),
  "utf8"
);

const commerceSql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../drizzle/0005_commerce_foundation.sql"),
  "utf8"
);

describe("foundation migration sql", () => {
  it("enables pgvector and defines searchable product columns", () => {
    expect(foundationSql).toContain("CREATE EXTENSION IF NOT EXISTS vector");
    expect(foundationSql).toContain("search_vector tsvector");
    expect(foundationSql).toContain("embedding vector(1536)");
    expect(foundationSql).toContain("migration_checkpoints");
  });
});

describe("commerce foundation migration sql", () => {
  it("defines customisation, orders, suppliers, and issue tables", () => {
    expect(commerceSql).toContain("CREATE TYPE customisation_mode");
    expect(commerceSql).toContain("CREATE TABLE orders");
    expect(commerceSql).toContain("CREATE TABLE order_items");
    expect(commerceSql).toContain("CREATE TABLE suppliers");
    expect(commerceSql).toContain("CREATE TABLE purchase_orders");
    expect(commerceSql).toContain("CREATE TABLE courier_rules");
    expect(commerceSql).toContain("CREATE TABLE issue_cases");
    expect(commerceSql).toContain("customisation_fingerprint");
    expect(commerceSql).toContain("CREATE TABLE ai_action_audits");
  });
});
