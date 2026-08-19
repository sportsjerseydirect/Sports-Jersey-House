import { describe, expect, it } from "vitest";
import { toBooleanFlag, creativeAssetSchema } from "./index";

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
});
