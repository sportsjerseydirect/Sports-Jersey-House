import { describe, expect, it } from "vitest";
import { EmptySearchProvider } from "@sjh/search";
import { PostgresSearchProvider } from "@sjh/search";
import { getSearchProvider } from "./search";

describe("getSearchProvider", () => {
  it("returns an empty provider when DATABASE_URL is unset", () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      expect(getSearchProvider()).toBeInstanceOf(EmptySearchProvider);
    } finally {
      if (original === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = original;
      }
    }
  });

  it("returns a postgres provider when DATABASE_URL is configured", () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://sjh:sjh@localhost:5432/sports_jersey_house";

    try {
      expect(getSearchProvider()).toBeInstanceOf(PostgresSearchProvider);
    } finally {
      if (original === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = original;
      }
    }
  });
});
