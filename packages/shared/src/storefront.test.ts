import { test, expect } from "vitest";
import {
  filterCustomerCollections,
  formatCartItemCount,
  formatCustomerFulfilmentStatus,
  isInternalCollectionSlug,
  resolveImageIndexForColour,
  resolveImageUrlForColour,
  sanitizeCollectionDescription
} from "./storefront";

test("isInternalCollectionSlug flags chatgpt handles", () => {
  expect(isInternalCollectionSlug("all-products-chatgpt-ai-product-description")).toBe(true);
  expect(isInternalCollectionSlug("nfl")).toBe(false);
});

test("sanitizeCollectionDescription strips development copy", () => {
  expect(
    sanitizeCollectionDescription("Development collection for Major League Baseball jerseys.")
  ).toBeUndefined();
});

test("filterCustomerCollections removes internal titles", () => {
  const filtered = filterCustomerCollections([
    {
      id: "1",
      slug: "soccer",
      title: "Soccer Jerseys",
      status: "published"
    },
    {
      id: "2",
      slug: "all-products-chatgpt-ai-product-description",
      title: "All Products (ChatGPT-AI Product Description)",
      status: "published"
    }
  ]);
  expect(filtered).toHaveLength(1);
  expect(filtered[0]?.slug).toBe("soccer");
});

test("resolveImageUrlForColour matches alt text", () => {
  const images = [
    { url: "https://cdn.example.com/white.jpg", altText: "White home kit" },
    { url: "https://cdn.example.com/green.jpg", altText: "Green away kit" }
  ];
  expect(resolveImageUrlForColour(images, "Green")).toBe("https://cdn.example.com/green.jpg");
  expect(resolveImageIndexForColour(images, "Green")).toBe(1);
});

test("formatCustomerFulfilmentStatus maps unfulfilled", () => {
  expect(formatCustomerFulfilmentStatus("unfulfilled")).toBe("Preparing your order");
});

test("formatCartItemCount pluralises", () => {
  expect(formatCartItemCount(1)).toBe("1 item ready for checkout.");
  expect(formatCartItemCount(2)).toBe("2 items ready for checkout.");
});
