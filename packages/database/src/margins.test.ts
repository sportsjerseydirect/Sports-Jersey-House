import { describe, expect, it } from "vitest";
import { computeLineMargin } from "./margins";

describe("computeLineMargin", () => {
  it("computes profit and margin from sell and costs", () => {
    const result = computeLineMargin({
      unitPriceAmount: "50.00",
      customisationPriceAmount: "10.00",
      discountAmount: "5.00",
      quantity: 2,
      supplierCostAmount: "40.00",
      customisationCostAmount: "4.00",
      fulfilmentCostAmount: "6.00",
      otherCostAmount: "0"
    });

    expect(result.sellAmount).toBe(100);
    expect(result.customisationRevenueAmount).toBe(20);
    expect(result.netRevenueAmount).toBe(115);
    expect(result.totalCostAmount).toBe(50);
    expect(result.grossProfitAmount).toBe(65);
    expect(result.marginPercent).toBe(56.52);
  });

  it("returns null margin when net revenue is zero", () => {
    const result = computeLineMargin({
      unitPriceAmount: "0",
      customisationPriceAmount: "0",
      discountAmount: "0",
      quantity: 1,
      supplierCostAmount: "10",
      customisationCostAmount: null,
      fulfilmentCostAmount: null,
      otherCostAmount: null
    });

    expect(result.marginPercent).toBeNull();
    expect(result.grossProfitAmount).toBe(-10);
  });
});
