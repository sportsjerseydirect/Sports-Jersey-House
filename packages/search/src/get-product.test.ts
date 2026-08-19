import { describe, expect, it } from "vitest";
import { resolveCatalogueImageUrl } from "./get-product";

describe("resolveCatalogueImageUrl", () => {
  it("returns absolute urls unchanged", () => {
    expect(resolveCatalogueImageUrl("https://cdn.example.com/jersey.png")).toBe(
      "https://cdn.example.com/jersey.png"
    );
  });

  it("prefixes local asset paths with APP_URL", () => {
    const original = process.env.APP_URL;
    process.env.APP_URL = "http://localhost:3000";

    try {
      expect(resolveCatalogueImageUrl("/dev/jersey-placeholder.svg")).toBe(
        "http://localhost:3000/dev/jersey-placeholder.svg"
      );
    } finally {
      if (original === undefined) {
        delete process.env.APP_URL;
      } else {
        process.env.APP_URL = original;
      }
    }
  });
});
