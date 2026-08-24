import { describe, expect, it } from "vitest";
import { amountToStripeCents, stripeFeeToDecimal } from "./payments";

describe("amountToStripeCents", () => {
  it("converts decimal money without floating error", () => {
    expect(amountToStripeCents("60.00")).toBe(6000);
    expect(amountToStripeCents("19.99")).toBe(1999);
    expect(amountToStripeCents("0.50")).toBe(50);
    expect(amountToStripeCents("100")).toBe(10000);
  });

  it("rejects invalid amounts", () => {
    expect(() => amountToStripeCents("10.999")).toThrow();
    expect(() => amountToStripeCents("-1.00")).toThrow();
    expect(() => amountToStripeCents("abc")).toThrow();
  });
});

describe("stripeFeeToDecimal", () => {
  it("formats fee cents", () => {
    expect(stripeFeeToDecimal(204)).toBe("2.04");
    expect(stripeFeeToDecimal(null)).toBe("0.00");
  });
});
