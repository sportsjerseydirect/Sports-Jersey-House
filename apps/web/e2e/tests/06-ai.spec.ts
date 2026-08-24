import { test, expect } from "@playwright/test";

test.describe("AI capability", () => {
  test("shopping assistant endpoint is honest when disabled", async ({ request }) => {
    const res = await request.post("/api/shopping-assistant", {
      data: { message: "Do you have Yankees jerseys?" }
    });
    expect([200, 503]).toContain(res.status());
    const body = (await res.json()) as { ok?: boolean; error?: string };
    if (res.status() === 503) {
      expect(body.ok).toBeFalsy();
      expect(body.error ?? "").toMatch(/disabled/i);
    }
  });
});
