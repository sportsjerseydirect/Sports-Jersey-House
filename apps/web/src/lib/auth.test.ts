import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  createAdminSessionToken,
  isAdminAuthRequired,
  verifyAdminPassword,
  verifyAdminSessionToken
} from "./auth";

describe("admin auth", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret";
    delete process.env.ADMIN_PASSWORD;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("creates and verifies a signed admin session", async () => {
    const token = await createAdminSessionToken();
    const session = await verifyAdminSessionToken(token);

    expect(session?.role).toBe("admin");
    expect(session?.exp).toBeGreaterThan(Date.now());
  });

  it("requires ADMIN_PASSWORD when configured", () => {
    process.env.ADMIN_PASSWORD = "local-admin";

    expect(isAdminAuthRequired()).toBe(true);
    expect(verifyAdminPassword("local-admin")).toBe(true);
    expect(verifyAdminPassword("wrong")).toBe(false);
  });
});
