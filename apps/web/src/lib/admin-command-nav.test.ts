import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_HREFS = [
  "/admin/orders",
  "/admin/suppliers",
  "/admin/purchase-orders",
  "/admin/tracking",
  "/admin/tracking/exceptions",
  "/admin/margins",
  "/admin/issues",
  "/admin/ai-ops",
  "/admin/jobs",
  "/admin/catalogue/products",
  "/admin/catalogue/agent",
  "/admin/migration",
  "/admin/marketing",
  "/admin/notifications"
];

describe("admin command centre navigation", () => {
  it("uses native anchor cards with required destination hrefs", () => {
    const page = readFileSync(join(process.cwd(), "app/admin/page.tsx"), "utf8");
    const card = readFileSync(
      join(process.cwd(), "src/components/admin-command-card.tsx"),
      "utf8"
    );

    expect(card).toContain("<a");
    expect(card).not.toMatch(/from "next\/link"/);

    for (const href of REQUIRED_HREFS) {
      expect(page).toContain(`href={"${href}" as Route}`);
    }
  });

  it("does not expose marketing lead overlay on admin surfaces", () => {
    const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    const chrome = readFileSync(
      join(process.cwd(), "src/components/storefront-chrome.tsx"),
      "utf8"
    );
    const middleware = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
    const lead = readFileSync(
      join(process.cwd(), "src/components/welcome-lead-capture.tsx"),
      "utf8"
    );

    expect(layout).toContain("StorefrontChrome");
    expect(chrome).toContain('pathname.startsWith("/admin")');
    expect(middleware).toContain("x-sjh-pathname");
    expect(lead).toContain('pathname.startsWith("/admin")');
  });
});
