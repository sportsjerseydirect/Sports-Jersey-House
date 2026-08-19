import type { ProductSummary } from "@sjh/shared";
import { productSummarySchema } from "@sjh/shared";
import type { Product, ProductVariant } from "@sjh/database";

export type ProductCatalogRow = Product & {
  variants: ProductVariant[];
  primaryImageUrl?: string;
};

export function mapProductToSummary(row: ProductCatalogRow): ProductSummary {
  const primaryVariant = row.variants.find((variant) => variant.isAvailable) ?? row.variants[0];

  return productSummarySchema.parse({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    vendor: row.vendor ?? undefined,
    sport: row.sport ?? undefined,
    league: row.league ?? undefined,
    team: row.team ?? undefined,
    primaryImageUrl: row.primaryImageUrl,
    price: primaryVariant
      ? {
          amount: primaryVariant.priceAmount,
          currencyCode: primaryVariant.currencyCode
        }
      : undefined
  });
}

export function mapProductsToSummaries(rows: ProductCatalogRow[]): ProductSummary[] {
  return rows.map(mapProductToSummary);
}
