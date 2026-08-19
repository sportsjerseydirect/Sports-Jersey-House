import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  createDatabaseClient,
  productImages,
  products,
  productVariants,
  type Product
} from "@sjh/database";
import { buildPostgresFullTextQuery, normalizeSearchQuery } from "./index";
import type { SearchProvider, SearchRequest, SearchResponse } from "./index";
import { mapProductToSummary } from "./map-product";

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

export class PostgresSearchProvider implements SearchProvider {
  constructor(private readonly db: DatabaseClient) {}

  async search(request: SearchRequest): Promise<SearchResponse> {
    const limit = Math.min(request.limit ?? 24, 100);
    const normalizedQuery = normalizeSearchQuery(request.query);
    const filters = request.filters;

    const conditions = [
      eq(products.status, "published"),
      isNull(products.deletedAt)
    ];

    if (normalizedQuery) {
      conditions.push(
        sql`${products.id} in (
          select id
          from products
          where search_vector @@ to_tsquery('english', ${buildPostgresFullTextQuery(normalizedQuery)})
        )`
      );
    }

    if (filters?.sport?.length) {
      conditions.push(inArray(products.sport, filters.sport));
    }

    if (filters?.league?.length) {
      conditions.push(inArray(products.league, filters.league));
    }

    if (filters?.team?.length) {
      conditions.push(inArray(products.team, filters.team));
    }

    const productRows = await this.db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(asc(products.title))
      .limit(limit);

    if (productRows.length === 0) {
      return { results: [], facets: [] };
    }

    const productIds = productRows.map((row) => row.id);
    const [variants, images] = await Promise.all([
      this.db
        .select()
        .from(productVariants)
        .where(and(inArray(productVariants.productId, productIds), isNull(productVariants.deletedAt))),
      this.db
        .select()
        .from(productImages)
        .where(and(inArray(productImages.productId, productIds), isNull(productImages.deletedAt)))
        .orderBy(asc(productImages.sortOrder))
    ]);

    const variantsByProduct = groupByProductId(variants);
    const imagesByProduct = groupByProductId(images);

    const results = productRows.map((product) => {
      const productVariantsForRow = variantsByProduct.get(product.id) ?? [];
      const primaryImage = imagesByProduct.get(product.id)?.[0];
      const primaryImageUrl = primaryImage ? resolveImageUrl(primaryImage.url) : undefined;

      return {
        product: mapProductToSummary({
          ...product,
          variants: productVariantsForRow,
          ...(primaryImageUrl ? { primaryImageUrl } : {})
        }),
        score: normalizedQuery ? 1 : 0.5,
        reasons: normalizedQuery ? ["keyword_match"] : ["catalogue_listing"]
      };
    });

    let filteredResults = results;

    if (filters?.availableOnly) {
      filteredResults = filteredResults.filter((result) =>
        result.product.price ? true : false
      );
    }

    if (filters?.priceMin !== undefined || filters?.priceMax !== undefined) {
      filteredResults = filteredResults.filter((result) => {
        if (!result.product.price) {
          return false;
        }

        const amount = Number(result.product.price.amount);

        if (filters.priceMin !== undefined && amount < filters.priceMin) {
          return false;
        }

        if (filters.priceMax !== undefined && amount > filters.priceMax) {
          return false;
        }

        return true;
      });
    }

    return {
      results: filteredResults,
      facets: buildFacetCounts(productRows)
    };
  }
}

function groupByProductId<TRow extends { productId: string }>(rows: TRow[]): Map<string, TRow[]> {
  const grouped = new Map<string, TRow[]>();

  for (const row of rows) {
    const existing = grouped.get(row.productId) ?? [];
    existing.push(row);
    grouped.set(row.productId, existing);
  }

  return grouped;
}

function resolveImageUrl(url: string): string | undefined {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
}

function buildFacetCounts(productRows: Product[]) {
  const sportCounts = countField(productRows, (row) => row.sport);
  const leagueCounts = countField(productRows, (row) => row.league);

  return [
    ...sportCounts.map(([value, count]) => ({
      field: "sport" as const,
      value,
      count
    })),
    ...leagueCounts.map(([value, count]) => ({
      field: "league" as const,
      value,
      count
    }))
  ];
}

function countField<TValue extends string | null>(
  rows: Product[],
  selector: (row: Product) => TValue
): Array<[string, number]> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const value = selector(row);

    if (!value) {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
}

export function createPostgresSearchProvider(databaseUrl: string): PostgresSearchProvider {
  return new PostgresSearchProvider(createDatabaseClient(databaseUrl));
}
