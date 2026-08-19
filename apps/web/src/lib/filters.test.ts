import { describe, expect, it } from "vitest";
import { buildCatalogueHref, parseCatalogueFilters, toggleCatalogueFilter } from "./filters";

describe("parseCatalogueFilters", () => {
  it("maps query params into search filters", () => {
    expect(parseCatalogueFilters({ league: "NFL,NBA", sport: "Football" })).toEqual({
      league: ["NFL", "NBA"],
      sport: ["Football"]
    });
  });
});

describe("buildCatalogueHref", () => {
  it("builds filter urls for products and search", () => {
    expect(buildCatalogueHref("/products", { league: "NFL" })).toBe("/products?league=NFL");
    expect(buildCatalogueHref("/search", { q: "Bears", league: "NFL" })).toBe(
      "/search?q=Bears&league=NFL"
    );
  });
});

describe("toggleCatalogueFilter", () => {
  it("adds and removes league filters", () => {
    expect(toggleCatalogueFilter("/products", {}, "league", "NFL")).toBe("/products?league=NFL");
    expect(toggleCatalogueFilter("/products", { league: "NFL" }, "league", "NFL")).toBe("/products");
    expect(toggleCatalogueFilter("/products", { league: "NFL" }, "league", "NBA")).toBe(
      "/products?league=NFL%2CNBA"
    );
  });
});
