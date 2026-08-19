import type { ProductDetail, ProductSummary } from "@sjh/shared";

export type SearchFilters = {
  market?: "US" | "CA";
  sport?: string[];
  league?: string[];
  team?: string[];
  priceMin?: number;
  priceMax?: number;
  availableOnly?: boolean;
};

export type SearchRequest = {
  query: string;
  filters?: SearchFilters;
  limit?: number;
  cursor?: string;
  semanticQueryEmbedding?: number[];
};

export type SearchFacet = {
  field: keyof SearchFilters;
  value: string;
  count: number;
};

export type SearchResult = {
  product: ProductSummary;
  score: number;
  reasons: string[];
};

export type SearchResponse = {
  results: SearchResult[];
  facets: SearchFacet[];
  nextCursor?: string;
};

export type SearchProvider = {
  search(request: SearchRequest): Promise<SearchResponse>;
  getProductBySlug(slug: string): Promise<ProductDetail | null>;
  listPublishedProductSlugs(limit?: number): Promise<string[]>;
};

export class EmptySearchProvider implements SearchProvider {
  async search(_request: SearchRequest): Promise<SearchResponse> {
    void _request;

    return {
      results: [],
      facets: []
    };
  }

  async getProductBySlug(_slug: string): Promise<ProductDetail | null> {
    void _slug;
    return null;
  }

  async listPublishedProductSlugs(_limit?: number): Promise<string[]> {
    void _limit;
    return [];
  }
}

export { createSearchProvider } from "./create-provider";
export { createProductCatalogue, getProductBySlug, listPublishedProductSlugs, resolveCatalogueImageUrl } from "./get-product";
export { PostgresSearchProvider, createPostgresSearchProvider } from "./postgres-provider";
export { mapProductToSummary, mapProductsToSummaries } from "./map-product";

export function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

export function buildPostgresFullTextQuery(query: string): string {
  return normalizeSearchQuery(query)
    .split(" ")
    .filter(Boolean)
    .map((term) => `${term}:*`)
    .join(" & ");
}
