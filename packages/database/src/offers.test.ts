import { describe, expect, it } from "vitest";
import { applyOfferToAmounts, computeDiscountForSubtotal } from "./offers";

describe("computeDiscountForSubtotal", () => {
  it("computes percent discount from subtotal", () => {
    expect(computeDiscountForSubtotal(100, 10)).toEqual({
      discountAmount: "10.00",
      percentOff: 10
    });
    expect(computeDiscountForSubtotal("49.99", "10")).toEqual({
      discountAmount: "5.00",
      percentOff: 10
    });
  });

  it("floors negative results at zero via formatMoney", () => {
    expect(computeDiscountForSubtotal(0, 10).discountAmount).toBe("0.00");
  });
});

describe("applyOfferToAmounts", () => {
  it("applies percent-off offers", () => {
    const result = applyOfferToAmounts(80, { percentOff: "10", amountOff: null });
    expect(result.discountAmount).toBe("8.00");
    expect(result.totalAfterDiscount).toBe("72.00");
    expect(result.percentOff).toBe(10);
  });

  it("caps amount-off at subtotal", () => {
    const result = applyOfferToAmounts(5, { percentOff: null, amountOff: "10" });
    expect(result.discountAmount).toBe("5.00");
    expect(result.totalAfterDiscount).toBe("0.00");
  });
});
