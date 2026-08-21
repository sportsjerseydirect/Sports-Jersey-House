import { describe, expect, it } from "vitest";
import { fingerprintCustomisation } from "./cart";
import { cartItems, carts } from "./index";

describe("cart schema", () => {
  it("defines session-backed cart tables with customisation columns", () => {
    expect(carts.sessionId.name).toBe("session_id");
    expect(carts.currencyCode.name).toBe("currency_code");
    expect(cartItems.quantity.name).toBe("quantity");
    expect(cartItems.variantId.name).toBe("variant_id");
    expect(cartItems.customisationFingerprint.name).toBe("customisation_fingerprint");
  });

  it("fingerprints distinct customisations separately from none", () => {
    expect(fingerprintCustomisation({ mode: "none" })).toBe("none");
    expect(fingerprintCustomisation({ mode: "name", name: "Smith" })).not.toBe("none");
    expect(fingerprintCustomisation({ mode: "name", name: "Smith" })).toBe(
      fingerprintCustomisation({ mode: "name", name: "smith" })
    );
  });
});
