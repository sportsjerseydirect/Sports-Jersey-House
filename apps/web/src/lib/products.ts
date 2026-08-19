import type { SearchResponse } from "@sjh/search";

export function productDetailPath(slug: string): `/products/${string}` {
  return `/products/${slug}`;
}

export function collectionDetailPath(slug: string): `/collections/${string}` {
  return `/collections/${slug}`;
}

export function formatProductPrice(amount: string, currencyCode: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode
  }).format(Number(amount));
}

export function hasCatalogueResults(response: SearchResponse): boolean {
  return response.results.length > 0;
}

export function catalogueSummaryCount(response: SearchResponse): number {
  return response.results.length;
}
