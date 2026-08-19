import { describe, expect, it } from "vitest";
import { buildHealthPayload } from "./health";

describe("buildHealthPayload", () => {
  it("returns a safe health payload without secrets", () => {
    const body = buildHealthPayload();

    expect(body.status).toBe("ok");
    expect(body.shopifySyncEnabled).toBe(false);
    expect(body).not.toHaveProperty("DATABASE_URL");
    expect(body).not.toHaveProperty("SHOPIFY_CLIENT_SECRET");
  });
});
