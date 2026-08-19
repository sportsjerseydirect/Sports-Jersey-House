import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, productJsonLd } from "./seo";

describe("productJsonLd", () => {
  it("builds Product and Offer structured data for detail pages", () => {
    const jsonLd = productJsonLd({
      id: "00000000-0000-4000-8000-000000000001",
      slug: "chicago-bears-classic-home-jersey",
      title: "Chicago Bears Classic Home Jersey",
      description: "Premium dev-catalog jersey.",
      status: "published",
      vendor: "Sports Jersey House Dev",
      league: "NFL",
      team: "Chicago Bears",
      images: [{ url: "http://localhost:3000/dev/jersey-placeholder.svg", altText: "Jersey" }],
      variants: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          title: "Medium",
          sku: "DEV-BEARS-HOME-M",
          price: { amount: "129.99", currencyCode: "USD" },
          isAvailable: true
        }
      ]
    });

    expect(jsonLd["@type"]).toBe("Product");
    expect(jsonLd.name).toBe("Chicago Bears Classic Home Jersey");
    expect(jsonLd.offers).toMatchObject({
      "@type": "Offer",
      price: "129.99",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock"
    });
  });
});

describe("breadcrumbJsonLd", () => {
  it("builds breadcrumb items with absolute urls", () => {
    const jsonLd = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Products", path: "/products" },
      { name: "Chicago Bears Classic Home Jersey", path: "/products/chicago-bears-classic-home-jersey" }
    ]);

    expect(jsonLd.itemListElement).toHaveLength(3);
    expect(jsonLd.itemListElement[2]?.name).toBe("Chicago Bears Classic Home Jersey");
  });
});
