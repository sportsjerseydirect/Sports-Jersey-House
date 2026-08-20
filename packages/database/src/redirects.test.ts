import { describe, expect, it } from "vitest";
import { normalizeRedirectPath } from "./redirects";

describe("normalizeRedirectPath", () => {
  it("ensures a leading slash", () => {
    expect(normalizeRedirectPath("products/old")).toBe("/products/old");
  });

  it("strips a trailing slash except for root", () => {
    expect(normalizeRedirectPath("/products/old/")).toBe("/products/old");
    expect(normalizeRedirectPath("/")).toBe("/");
  });
});
