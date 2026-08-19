import { describe, expect, it } from "vitest";
import { createJobEnvelope, queueNames } from "./index-core";

describe("worker queues", () => {
  it("defines stable queue names", () => {
    expect(queueNames).toContain("shopify:extract");
    expect(queueNames).toContain("search:embed");
  });

  it("creates deterministic job envelopes", () => {
    const envelope = createJobEnvelope("shopify:extract", { page: 1 }, "migration");

    expect(envelope.queue).toBe("shopify:extract");
    expect(envelope.requestedBy).toBe("migration");
    expect(envelope.idempotencyKey).toContain("shopify:extract");
  });
});
