import { describe, expect, it } from "vitest";
import { collectWebhookSigningSecrets } from "./stripe";

describe("collectWebhookSigningSecrets", () => {
  it("deduplicates env and stored secrets", () => {
    expect(collectWebhookSigningSecrets("whsec_a", "whsec_a")).toEqual(["whsec_a"]);
    expect(collectWebhookSigningSecrets("whsec_a", "whsec_b")).toEqual(["whsec_a", "whsec_b"]);
  });

  it("drops live and empty secrets", () => {
    expect(collectWebhookSigningSecrets("whsec_live_x", "whsec_test")).toEqual(["whsec_test"]);
    expect(collectWebhookSigningSecrets("  ", null)).toEqual([]);
  });
});
