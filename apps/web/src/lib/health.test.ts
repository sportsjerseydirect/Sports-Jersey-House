import { describe, expect, it } from "vitest";
import { buildHealthPayload } from "./health";

describe("buildHealthPayload", () => {
  it("returns a safe health payload without secrets", async () => {
    const body = await buildHealthPayload();

    expect(["ok", "degraded"]).toContain(body.status);
    expect(body.shopifySyncEnabled).toBe(false);
    expect(body.database).toEqual(
      expect.objectContaining({
        configured: expect.any(Boolean),
        reachable: expect.any(Boolean)
      })
    );
    expect(body.stripe).toEqual(
      expect.objectContaining({
        paymentsEnabled: expect.any(Boolean),
        secretKeyConfigured: expect.any(Boolean),
        secretKeyIsTest: expect.any(Boolean),
        secretKeyIsLive: expect.any(Boolean),
        publishableKeyConfigured: expect.any(Boolean),
        publishableKeyIsTest: expect.any(Boolean),
        publishableKeyIsLive: expect.any(Boolean),
        webhookSecretConfigured: expect.any(Boolean),
        readyForTestCheckout: expect.any(Boolean)
      })
    );
    expect(JSON.stringify(body)).not.toMatch(/sk_(test|live)_|pk_(test|live)_|whsec_/);
    expect(body).not.toHaveProperty("DATABASE_URL");
    expect(body).not.toHaveProperty("SHOPIFY_CLIENT_SECRET");
  });
});
