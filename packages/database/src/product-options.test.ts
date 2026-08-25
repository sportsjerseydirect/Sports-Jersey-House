import { describe, expect, it } from "vitest";
import {
  fingerprintSelectedOptions,
  formatSelectedOptionsSummary,
  selectedOptionsToCartCustomisation,
  selectedProductOptionsSchema
} from "@sjh/shared";
import { optionsFingerprint, toLegacyCustomisation } from "./product-options";

describe("product options server helpers", () => {
  it("maps selected options to legacy custom mode for orders/PO", () => {
    const selected = selectedProductOptionsSchema.parse({
      colour: "White",
      size: "XL/Men's",
      customisation: { enabled: true, name: "CHADHA", number: "07", message: "TEST" }
    });
    expect(toLegacyCustomisation(selected)).toEqual(
      selectedOptionsToCartCustomisation(selected)
    );
    expect(toLegacyCustomisation(selected).mode).toBe("custom");
  });

  it("fingerprints size distinctly for cart uniqueness", () => {
    const a = selectedProductOptionsSchema.parse({
      size: "S/Men's",
      customisation: { enabled: false }
    });
    const b = selectedProductOptionsSchema.parse({
      size: "L/Men's",
      customisation: { enabled: false }
    });
    expect(optionsFingerprint(a)).toBe(fingerprintSelectedOptions(a));
    expect(optionsFingerprint(a)).not.toBe(optionsFingerprint(b));
  });

  it("formats fulfilment summary without confusing colour for size", () => {
    const selected = selectedProductOptionsSchema.parse({
      colour: "Cream",
      size: "M/Men's",
      customisation: { enabled: false }
    });
    const lines = formatSelectedOptionsSummary(selected);
    expect(lines).toContain("Colour: Cream");
    expect(lines).toContain("Size: M/Men's");
    expect(lines.some((l) => /^Size:\s*Cream$/i.test(l))).toBe(false);
  });
});
