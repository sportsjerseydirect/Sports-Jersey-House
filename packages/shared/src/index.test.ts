import { describe, expect, it } from "vitest";
import {
  cartCustomisationSchema,
  creativeAssetSchema,
  customisationPriceForMode,
  toBooleanFlag
} from "./index";

describe("shared contracts", () => {
  it("parses boolean feature flags conservatively", () => {
    expect(toBooleanFlag("true")).toBe(true);
    expect(toBooleanFlag("false")).toBe(false);
    expect(toBooleanFlag(undefined)).toBe(false);
    expect(toBooleanFlag("TRUE")).toBe(false);
  });

  it("requires creative provenance and approval states", () => {
    const parsed = creativeAssetSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      assetType: "logo",
      brief: "Original Sports Jersey House logo concept.",
      provider: "openai",
      model: "image-model",
      width: 1024,
      height: 1024,
      format: "png",
      status: "under_review",
      complianceStatus: "under_review",
      version: 1,
      provenance: "Generated from an approved internal creative brief.",
      altText: "Sports Jersey House logo concept"
    });

    expect(parsed.status).toBe("under_review");
    expect(parsed.complianceStatus).toBe("under_review");
  });

  it("validates jersey customisation payloads", () => {
    expect(cartCustomisationSchema.parse({ mode: "none" }).mode).toBe("none");
    expect(() => cartCustomisationSchema.parse({ mode: "name" })).toThrow();
    expect(cartCustomisationSchema.parse({ mode: "name_number", name: "Jordan", number: "23" }).number).toBe(
      "23"
    );
    expect(
      customisationPriceForMode(
        {
          namePriceAmount: "15.00",
          numberPriceAmount: "10.00",
          nameNumberPriceAmount: "20.00",
          messagePriceAmount: "0.00"
        },
        "name_number"
      )
    ).toBe("20.00");
  });
});
