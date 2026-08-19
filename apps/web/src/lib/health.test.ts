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
    expect(body).not.toHaveProperty("DATABASE_URL");
    expect(body).not.toHaveProperty("SHOPIFY_CLIENT_SECRET");
  });
});
