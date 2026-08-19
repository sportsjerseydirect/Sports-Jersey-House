import type { CollectionDetail, ProductDetail, ProductSummary, CollectionSummary } from "@sjh/shared";

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
  getCollectionBySlug(slug: string): Promise<CollectionDetail | null>;
  listPublishedCollectionSlugs(limit?: number): Promise<string[]>;
  listPublishedCollections(limit?: number): Promise<CollectionSummary[]>;
  getCatalogueFacets(): Promise<SearchFacet[]>;
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

  async getCollectionBySlug(_slug: string): Promise<CollectionDetail | null> {
    void _slug;
    return null;
  }

  async listPublishedCollectionSlugs(_limit?: number): Promise<string[]> {
    void _limit;
    return [];
  }

  async listPublishedCollections(_limit?: number): Promise<CollectionSummary[]> {
    void _limit;
    return [];
  }

  async getCatalogueFacets(): Promise<SearchFacet[]> {
    return [];
  }
}

export { createSearchProvider } from "./create-provider";
export {
  createCollectionCatalogue,
  getCatalogueFacets,
  getCollectionBySlug,
  listPublishedCollectionSlugs,
  listPublishedCollections
} from "./get-collection";
export { createProductCatalogue, getProductBySlug, listPublishedProductSlugs, loadProductSummaries, resolveCatalogueImageUrl } from "./get-product";
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
