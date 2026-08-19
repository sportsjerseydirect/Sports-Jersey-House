import { describe, expect, it } from "vitest";
import { buildPostgresFullTextQuery, normalizeSearchQuery } from "./index";

describe("search helpers", () => {
  it("normalizes whitespace", () => {
    expect(normalizeSearchQuery("  chicago    bears   jersey  ")).toBe("chicago bears jersey");
  });

  it("builds a prefix full-text query for PostgreSQL", () => {
    expect(buildPostgresFullTextQuery("chicago bears")).toBe("chicago:* & bears:*");
  });
});
