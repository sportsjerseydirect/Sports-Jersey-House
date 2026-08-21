import { describe, expect, it } from "vitest";
import { selectRepresentativeSample } from "../migration/sample-import";
import type { ShopifyProductNode } from "../index";

function fakeNode(id: string, title: string, tags: string[]): ShopifyProductNode {
  return {
    id,
    title,
    handle: id,
    status: "ACTIVE",
    vendor: "SJD",
    productType: "Jersey",
    tags,
    descriptionHtml: "",
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
    featuredImage: null,
    images: { edges: [] },
    variants: { edges: [] },
    collections: { edges: [] }
  } as unknown as ShopifyProductNode;
}

describe("selectRepresentativeSample", () => {
  it("spreads selection across league buckets", () => {
    const nodes = [
      ...Array.from({ length: 20 }, (_, i) => fakeNode(`nfl-${i}`, `NFL Player ${i}`, ["NFL"])),
      ...Array.from({ length: 20 }, (_, i) => fakeNode(`nba-${i}`, `NBA Player ${i}`, ["NBA"])),
      ...Array.from({ length: 20 }, (_, i) => fakeNode(`nhl-${i}`, `NHL Player ${i}`, ["NHL"])),
      ...Array.from({ length: 20 }, (_, i) => fakeNode(`mlb-${i}`, `MLB Player ${i}`, ["MLB"]))
    ];

    const selected = selectRepresentativeSample(nodes, 12);
    expect(selected).toHaveLength(12);
    const titles = selected.map((n) => n.title);
    expect(titles.some((t) => t.includes("NFL"))).toBe(true);
    expect(titles.some((t) => t.includes("NBA"))).toBe(true);
    expect(titles.some((t) => t.includes("NHL"))).toBe(true);
    expect(titles.some((t) => t.includes("MLB"))).toBe(true);
  });
});
