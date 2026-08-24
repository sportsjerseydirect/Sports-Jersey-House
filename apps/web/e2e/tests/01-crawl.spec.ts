import { test, expect, type Page, type Response } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.SJH_BASE_URL ?? "https://sports-jersey-house.vercel.app";

type Issue = {
  id: string;
  severity: "P0" | "P1" | "P2" | "P3";
  area: string;
  url: string;
  reproduction: string;
  expected: string;
  actual: string;
};

function collectConsole(page: Page) {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("response", (res: Response) => {
    if (res.status() >= 400 && !res.url().includes("favicon")) {
      failed.push(`${res.status()} ${res.url()}`);
    }
  });
  return { errors, failed };
}

test.describe("production crawl", () => {
  test("crawl key storefront routes desktop", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "desktop crawl once");
    const issues: Issue[] = [];
    const { errors, failed } = collectConsole(page);
    const visited = new Set<string>();
    const queue = ["/", "/products", "/search", "/collections", "/checkout", "/cart"];

    while (queue.length && visited.size < 24) {
      const path = queue.shift()!;
      if (visited.has(path)) continue;
      visited.add(path);
      const url = new URL(path, BASE).toString();
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      const status = res?.status() ?? 0;
      if (status >= 400 && path !== "/checkout") {
        issues.push({
          id: `HTTP-${status}-${path}`,
          severity: status >= 500 ? "P0" : "P1",
          area: "storefront",
          url,
          reproduction: `GET ${path}`,
          expected: "2xx",
          actual: String(status)
        });
      }

      const brokenImages = await page.evaluate(() =>
        Array.from(document.images)
          .filter((img) => !img.complete || img.naturalWidth === 0)
          .map((img) => img.src)
          .slice(0, 20)
      );
      for (const src of brokenImages) {
        issues.push({
          id: `IMG-${path}-${src.slice(-40)}`,
          severity: "P2",
          area: "images",
          url,
          reproduction: `Open ${path}`,
          expected: "images load",
          actual: `broken ${src}`
        });
      }

      const hrefs = await page.$$eval("a[href]", (anchors) =>
        anchors
          .map((a) => (a as HTMLAnchorElement).getAttribute("href") || "")
          .filter((h) => h.startsWith("/") && !h.startsWith("//") && !h.startsWith("/admin") && !h.startsWith("/api"))
      );
      for (const href of hrefs) {
        const clean = href.split("#")[0]!.split("?")[0]!;
        if (
          !visited.has(clean) &&
          queue.length < 80 &&
          (clean.startsWith("/products") ||
            clean.startsWith("/collections") ||
            clean.startsWith("/search") ||
            clean.startsWith("/pages"))
        ) {
          queue.push(clean);
        }
      }
    }

    // Seed sport searches
    for (const q of ["nhl", "mlb", "soccer", "nba", "nfl"]) {
      await page.goto(`/search?q=${q}`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main")).toBeVisible();
    }

    mkdirSync(join(process.cwd(), "test-results"), { recursive: true });
    writeFileSync(
      join(process.cwd(), "test-results", "crawl-findings.json"),
      JSON.stringify({ visited: [...visited], consoleErrors: errors.slice(0, 50), failedNetwork: failed.slice(0, 50), issues }, null, 2)
    );

    // Soft assert: no 5xx during crawl of visited pages
    const p0 = issues.filter((i) => i.severity === "P0");
    expect(p0, JSON.stringify(p0, null, 2)).toEqual([]);
  });
});
