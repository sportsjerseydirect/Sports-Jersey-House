import { describe, expect, it } from "vitest";
import { createJobEnvelope, queueNames } from "./index-core";

describe("worker queues", () => {
  it("defines stable queue names", () => {
    expect(queueNames).toContain("shopify:extract");
    expect(queueNames).toContain("shopify:extract-collections");
    expect(queueNames).toContain("search:embed");
    expect(queueNames).toContain("ops:daily-po-batch");
    expect(queueNames).toContain("ops:tracking-request");
    expect(queueNames).toContain("ops:tracking-check");
    expect(queueNames).toContain("ops:exception-detection");
    expect(queueNames).toContain("ops:margin-refresh");
  });

  it("creates deterministic job envelopes", () => {
    const envelope = createJobEnvelope("shopify:extract", { page: 1 }, "migration");

    expect(envelope.queue).toBe("shopify:extract");
    expect(envelope.requestedBy).toBe("migration");
    expect(envelope.idempotencyKey).toContain("shopify:extract");
  });
});
