import { describe, expect, it } from "vitest";
import { creativeAssets, migrationCheckpoints, migrationRuns, products } from "./index";
import { fromExtractionCheckpoint, toExtractionCheckpoint } from "./checkpoints";

describe("database schema", () => {
  it("defines commerce, creative, and migration tables", () => {
    expect(products.id.name).toBe("id");
    expect(creativeAssets.brief.name).toBe("brief");
    expect(migrationRuns.status.name).toBe("status");
    expect(migrationCheckpoints.resource.name).toBe("resource");
  });
});

describe("migration checkpoints", () => {
  it("round-trips extraction checkpoint state through jsonb payload", () => {
    const checkpoint = {
      resource: "products" as const,
      cursor: "cursor-42",
      completed: false,
      importedCount: 1200
    };

    const row = fromExtractionCheckpoint(checkpoint);
    const restored = toExtractionCheckpoint({
      resource: row.resource,
      cursor: row.cursor,
      completed: row.completed,
      payload: row.payload
    });

    expect(restored).toEqual(checkpoint);
  });
});
