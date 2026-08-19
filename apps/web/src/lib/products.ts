import type { SearchResponse } from "@sjh/search";

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
