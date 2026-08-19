import { describe, expect, it } from "vitest";
import { extractionCheckpointSchema, migrationCheckpointPayloadSchema } from "./index";

describe("migration checkpoint contracts", () => {
  it("validates extraction checkpoint resources and counters", () => {
    const checkpoint = extractionCheckpointSchema.parse({
      resource: "products",
      cursor: "cursor-1",
      completed: false,
      importedCount: 250
    });

    expect(checkpoint.resource).toBe("products");
    expect(checkpoint.importedCount).toBe(250);
  });

  it("defaults imported count in checkpoint payloads", () => {
    expect(migrationCheckpointPayloadSchema.parse({})).toEqual({ importedCount: 0 });
  });
});
