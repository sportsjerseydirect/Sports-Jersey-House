import { test, expect } from "@playwright/test";

const ADMIN_PATHS = [
  "/admin",
  "/admin/orders",
  "/admin/margins",
  "/admin/jobs",
  "/admin/catalogue",
  "/admin/users",
  "/admin/suppliers",
  "/admin/purchase-orders",
  "/admin/issues",
  "/admin/tracking",
  "/admin/marketing",
  "/admin/migration",
  "/admin/ai-ops",
  "/admin/notifications",
  "/admin/courier-rules"
];

const ADMIN_APIS = [
  "/api/admin/jobs/run",
  "/api/admin/catalogue/products",
  "/api/admin/users",
  "/api/admin/margins"
];

const ADMIN_GET_APIS = [
  "/api/admin/catalogue/products",
  "/api/admin/users",
  "/api/admin/shopify/health",
  "/api/admin/shopify/import",
  "/api/admin/catalogue/proposals",
  "/api/admin/catalogue/agent",
  "/api/admin/tracking/exceptions"
];

test.describe("auth boundaries", () => {
  for (const path of ADMIN_PATHS) {
    test(`unauthenticated ${path} is not an admin dashboard`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res).toBeTruthy();
      const url = page.url();
      const body = await page.locator("body").innerText();
      const blocked =
        url.includes("/admin/login") ||
        /sign in|password|not authorised|unauthorized/i.test(body);
      expect(blocked).toBeTruthy();
    });
  }

  for (const path of ADMIN_APIS) {
    test(`unauthenticated POST ${path} is 401`, async ({ request }) => {
      const res = await request.post(path, { data: { jobType: "daily_po_batch" } });
      expect([401, 403, 405]).toContain(res.status());
    });
  }

  for (const path of ADMIN_GET_APIS) {
    test(`unauthenticated GET ${path} is 401`, async ({ request }) => {
      const res = await request.get(path);
      expect([401, 403]).toContain(res.status());
    });
  }

  test("supplier APIs require session", async ({ request }) => {
    const res = await request.post("/api/supplier/orders/PO-5009/cost", {
      data: { amount: "1.00" }
    });
    expect([401, 403, 404]).toContain(res.status());
  });

  test("live Stripe keys are rejected by health", async ({ request }) => {
    const health = await request.get("/api/health");
    const json = (await health.json()) as {
      stripe?: { secretKeyPrefix?: string; publishableKeyPrefix?: string; readyForTestCheckout?: boolean };
    };
    expect(json.stripe?.secretKeyPrefix).toBe("sk_test_");
    expect(json.stripe?.publishableKeyPrefix).toBe("pk_test_");
    expect(json.stripe?.readyForTestCheckout).toBeTruthy();
  });
});
