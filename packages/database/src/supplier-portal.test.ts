import { describe, expect, it } from "vitest";
import { normalizeProductionCustomisation, formatProductionSpec } from "@sjh/shared";

describe("normalizeProductionCustomisation", () => {
  it("uppercases custom names for supplier production spec", () => {
    const result = normalizeProductionCustomisation({
      mode: "name_number",
      name: "chadha",
      number: "10"
    });
    expect(result.name).toBe("CHADHA");
    expect(result.number).toBe("10");
  });

  it("formats production spec for fulfilment", () => {
    const spec = formatProductionSpec({
      mode: "name_number",
      name: "CHADHA",
      number: "10"
    });
    expect(spec).toContain("CHADHA");
    expect(spec).toContain("10");
  });
});

describe("classifySupplierPoBucket", () => {
  it("classifies new POs", async () => {
    const { classifySupplierPoBucket } = await import("./supplier-portal");
    expect(
      classifySupplierPoBucket({
        status: "sent",
        acknowledgedAt: null,
        awaitingTracking: true,
        supplierReceivedAt: null
      })
    ).toBe("new");
  });
});
