import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../drizzle/0000_foundation.sql"),
  "utf8"
);

describe("foundation migration sql", () => {
  it("enables pgvector and defines searchable product columns", () => {
    expect(migrationSql).toContain('CREATE EXTENSION IF NOT EXISTS vector');
    expect(migrationSql).toContain("search_vector tsvector");
    expect(migrationSql).toContain("embedding vector(1536)");
    expect(migrationSql).toContain("migration_checkpoints");
  });
});
