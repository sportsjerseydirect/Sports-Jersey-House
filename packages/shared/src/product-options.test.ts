import { describe, expect, it } from "vitest";
import {
  colourFromVariantOptions,
  customisationPriceForSelected,
  fingerprintSelectedOptions,
  formatSelectedOptionsSummary,
  getSizeOptionSet,
  selectedOptionsToCartCustomisation,
  selectedProductOptionsSchema,
  sizeOptionSetSlugForSport,
  validateSizeAgainstOptionSet,
  variantAxisFromOptions
} from "./product-options";

describe("product options model", () => {
  it("maps sports to confirmed Aris option sets only", () => {
    expect(sizeOptionSetSlugForSport("Baseball")).toBe("baseball-jerseys");
    expect(sizeOptionSetSlugForSport("Hockey")).toBe("hockey-jerseys");
    expect(sizeOptionSetSlugForSport("Soccer")).toBe("soccer-jerseys");
    expect(sizeOptionSetSlugForSport("Football")).toBeNull();
    expect(sizeOptionSetSlugForSport("Basketball")).toBeNull();
  });

  it("never treats Color or Default Title as size values", () => {
    expect(colourFromVariantOptions({ Color: "White" }, "White")).toBe("White");
    expect(colourFromVariantOptions({ Title: "Default Title" }, "Default Title")).toBeNull();
    expect(variantAxisFromOptions({ Color: "Gray" })).toBe("colour");
    expect(variantAxisFromOptions({ Title: "Default Title" })).toBe("title");
  });

  it("validates sizes against option set", () => {
    expect(validateSizeAgainstOptionSet("M/Men's", "hockey-jerseys").ok).toBe(true);
    expect(validateSizeAgainstOptionSet("White", "hockey-jerseys").ok).toBe(false);
    expect(validateSizeAgainstOptionSet("M/Men's", null).ok).toBe(false);
  });

  it("prices SJD customisation flat at 4.99 when enabled", () => {
    expect(customisationPriceForSelected(true)).toBe("4.99");
    expect(customisationPriceForSelected(false)).toBe("0.00");
  });

  it("formats cart/order summary with colour and size separated", () => {
    const options = selectedProductOptionsSchema.parse({
      colour: "White",
      size: "XL/Men's",
      customisation: { enabled: true, name: "CHADHA", number: "07", message: "TEST" }
    });
    expect(formatSelectedOptionsSummary(options)).toEqual([
      "Colour: White",
      "Size: XL/Men's",
      "Customisation: Yes",
      "Name: CHADHA",
      "Number: 07",
      "Message: TEST"
    ]);
  });

  it("fingerprints include size so cart lines do not collapse", () => {
    const a = selectedProductOptionsSchema.parse({
      size: "M/Men's",
      customisation: { enabled: false }
    });
    const b = selectedProductOptionsSchema.parse({
      size: "L/Men's",
      customisation: { enabled: false }
    });
    expect(fingerprintSelectedOptions(a)).not.toBe(fingerprintSelectedOptions(b));
  });

  it("maps selected options to legacy customisation mode custom", () => {
    const legacy = selectedOptionsToCartCustomisation(
      selectedProductOptionsSchema.parse({
        size: "S/Men's",
        customisation: { enabled: true, name: "AK" }
      })
    );
    expect(legacy.mode).toBe("custom");
    expect(legacy.name).toBe("AK");
  });

  it("exposes hockey size list from Aris snapshot", () => {
    const set = getSizeOptionSet("hockey-jerseys");
    expect(set?.sizes).toContain("S/Men's");
    expect(set?.sizes).toContain("Youth/XL");
  });
});
