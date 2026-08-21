import { and, asc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import {
  createDatabaseClient,
  customisationProfiles,
  productImages,
  products,
  productVariants,
  sizeCharts,
  type Product
} from "@sjh/database";
import type { ProductDetail, ProductSummary } from "@sjh/shared";
import { productDetailSchema } from "@sjh/shared";
import { mapProductToSummary } from "./map-product";

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

export function resolveCatalogueImageUrl(url: string): string | undefined {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
}

function mapVariant(variant: {
  id: string;
  title: string;
  sku: string | null;
  sizeLabel: string | null;
  priceAmount: string;
  compareAtAmount: string | null;
  currencyCode: string;
  isAvailable: boolean;
}) {
  return {
    id: variant.id,
    title: variant.title,
    sku: variant.sku ?? undefined,
    sizeLabel: variant.sizeLabel ?? undefined,
    price: {
      amount: variant.priceAmount,
      currencyCode: variant.currencyCode as "USD" | "CAD" | "GBP"
    },
    ...(variant.compareAtAmount
      ? {
          compareAtPrice: {
            amount: variant.compareAtAmount,
            currencyCode: variant.currencyCode as "USD" | "CAD" | "GBP"
          }
        }
      : {}),
    isAvailable: variant.isAvailable
  };
}

export async function getProductBySlug(
  db: DatabaseClient,
  slug: string,
  options: { allowedStatuses?: Array<"draft" | "review" | "approved" | "published" | "archived"> } = {}
): Promise<ProductDetail | null> {
  const allowedStatuses = options.allowedStatuses ?? ["published"];
  const [product] = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.slug, slug),
        inArray(products.status, allowedStatuses),
        isNull(products.deletedAt)
      )
    )
    .limit(1);

  if (!product) {
    return null;
  }

  const [variants, images, sizeChartRows, profileRows] = await Promise.all([
    db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.productId, product.id), isNull(productVariants.deletedAt)))
      .orderBy(asc(productVariants.title)),
    db
      .select()
      .from(productImages)
      .where(and(eq(productImages.productId, product.id), isNull(productImages.deletedAt)))
      .orderBy(asc(productImages.sortOrder)),
    product.sizeChartId
      ? db
          .select()
          .from(sizeCharts)
          .where(and(eq(sizeCharts.id, product.sizeChartId), isNull(sizeCharts.deletedAt)))
          .limit(1)
      : Promise.resolve([]),
    product.customisationProfileId
      ? db
          .select()
          .from(customisationProfiles)
          .where(
            and(
              eq(customisationProfiles.id, product.customisationProfileId),
              isNull(customisationProfiles.deletedAt)
            )
          )
          .limit(1)
      : Promise.resolve([])
  ]);

  const primaryImage = images[0];
  const primaryImageUrl = primaryImage ? resolveCatalogueImageUrl(primaryImage.url) : undefined;
  const summary = mapProductToSummary({
    ...product,
    variants,
    ...(primaryImageUrl ? { primaryImageUrl } : {})
  });

  const sizeChart = sizeChartRows[0];
  const profile = profileRows[0];

  return productDetailSchema.parse({
    ...summary,
    playerName: product.playerName ?? undefined,
    careInstructions: product.careInstructions ?? undefined,
    shippingExpectations: product.shippingExpectations ?? undefined,
    faqs: Array.isArray(product.faqs) ? product.faqs : [],
    customisationEnabled: product.customisationEnabled,
    ...(sizeChart
      ? {
          sizeChart: {
            id: sizeChart.id,
            slug: sizeChart.slug,
            title: sizeChart.title,
            sport: sizeChart.sport ?? undefined,
            description: sizeChart.description ?? undefined,
            rows: Array.isArray(sizeChart.rows) ? sizeChart.rows : [],
            notes: sizeChart.notes ?? undefined
          }
        }
      : {}),
    ...(profile
      ? {
          customisationProfile: {
            id: profile.id,
            slug: profile.slug,
            title: profile.title,
            description: profile.description ?? undefined,
            allowedModes: profile.allowedModes,
            nameMaxLength: profile.nameMaxLength,
            numberMaxLength: profile.numberMaxLength,
            messageMaxLength: profile.messageMaxLength,
            namePriceAmount: profile.namePriceAmount,
            numberPriceAmount: profile.numberPriceAmount,
            nameNumberPriceAmount: profile.nameNumberPriceAmount,
            messagePriceAmount: profile.messagePriceAmount,
            currencyCode: profile.currencyCode,
            requiresSize: profile.requiresSize
          }
        }
      : {}),
    variants: variants.map(mapVariant),
    images: images
      .map((image) => {
        const url = resolveCatalogueImageUrl(image.url);
        return url ? { url, altText: image.altText ?? undefined } : null;
      })
      .filter((image): image is NonNullable<typeof image> => image !== null)
  });
}

export async function getRelatedProducts(
  db: DatabaseClient,
  product: Pick<Product, "id" | "team" | "league" | "sport">,
  limit = 4
): Promise<ProductSummary[]> {
  const affinityFilters = [
    product.team ? eq(products.team, product.team) : undefined,
    product.league ? eq(products.league, product.league) : undefined,
    product.sport ? eq(products.sport, product.sport) : undefined
  ].filter((value): value is NonNullable<typeof value> => Boolean(value));

  const whereClause =
    affinityFilters.length > 0
      ? and(
          eq(products.status, "published"),
          isNull(products.deletedAt),
          ne(products.id, product.id),
          or(...affinityFilters)
        )
      : and(eq(products.status, "published"), isNull(products.deletedAt), ne(products.id, product.id));

  const rows = await db
    .select()
    .from(products)
    .where(whereClause)
    .orderBy(asc(products.title))
    .limit(limit);

  return loadProductSummaries(db, rows);
}

export async function loadProductSummaries(
  db: DatabaseClient,
  productRows: Product[]
): Promise<ProductSummary[]> {
  if (productRows.length === 0) {
    return [];
  }

  const productIds = productRows.map((row) => row.id);
  const [variants, images] = await Promise.all([
    db
      .select()
      .from(productVariants)
      .where(and(inArray(productVariants.productId, productIds), isNull(productVariants.deletedAt))),
    db
      .select()
      .from(productImages)
      .where(and(inArray(productImages.productId, productIds), isNull(productImages.deletedAt)))
      .orderBy(asc(productImages.sortOrder))
  ]);

  const variantsByProduct = groupRowsByProductId(variants);
  const imagesByProduct = groupRowsByProductId(images);

  return productRows.map((product) => {
    const productVariantsForRow = variantsByProduct.get(product.id) ?? [];
    const primaryImage = imagesByProduct.get(product.id)?.[0];
    const primaryImageUrl = primaryImage ? resolveCatalogueImageUrl(primaryImage.url) : undefined;

    return mapProductToSummary({
      ...product,
      variants: productVariantsForRow,
      ...(primaryImageUrl ? { primaryImageUrl } : {})
    });
  });
}

function groupRowsByProductId<TRow extends { productId: string }>(rows: TRow[]): Map<string, TRow[]> {
  const grouped = new Map<string, TRow[]>();

  for (const row of rows) {
    const existing = grouped.get(row.productId) ?? [];
    existing.push(row);
    grouped.set(row.productId, existing);
  }

  return grouped;
}

export async function listPublishedProductSlugs(
  db: DatabaseClient,
  limit = 5000
): Promise<string[]> {
  const rows = await db
    .select({ slug: products.slug })
    .from(products)
    .where(and(eq(products.status, "published"), isNull(products.deletedAt)))
    .orderBy(asc(products.slug))
    .limit(limit);

  return rows.map((row) => row.slug);
}

export function createProductCatalogue(databaseUrl: string) {
  const db = createDatabaseClient(databaseUrl);

  return {
    getProductBySlug: (slug: string) => getProductBySlug(db, slug),
    listPublishedProductSlugs: (limit?: number) => listPublishedProductSlugs(db, limit)
  };
}
