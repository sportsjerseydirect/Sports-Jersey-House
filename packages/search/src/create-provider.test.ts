import { describe, expect, it } from "vitest";
import { createSearchProvider } from "./create-provider";
import { EmptySearchProvider } from "./index";
import { PostgresSearchProvider } from "./postgres-provider";

describe("createSearchProvider", () => {
  it("returns an empty provider when no database url is configured", () => {
    const provider = createSearchProvider();

    expect(provider).toBeInstanceOf(EmptySearchProvider);
  });

  it("returns a postgres provider when DATABASE_URL is available", () => {
    const provider = createSearchProvider({
      databaseUrl: "postgresql://sjh:sjh@localhost:5432/sports_jersey_house"
    });

    expect(provider).toBeInstanceOf(PostgresSearchProvider);
  });
});
