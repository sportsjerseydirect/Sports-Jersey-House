import { describe, expect, it } from "vitest";
import { cartItems, carts } from "./index";

describe("cart schema", () => {
  it("defines session-backed cart tables", () => {
    expect(carts.sessionId.name).toBe("session_id");
    expect(carts.currencyCode.name).toBe("currency_code");
    expect(cartItems.quantity.name).toBe("quantity");
    expect(cartItems.variantId.name).toBe("variant_id");
  });
});
