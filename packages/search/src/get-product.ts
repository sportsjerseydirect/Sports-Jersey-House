import { and, asc, eq, isNull } from "drizzle-orm";
import {
  createDatabaseClient,
  productImages,
  products,
  productVariants
} from "@sjh/database";
import type { ProductDetail } from "@sjh/shared";
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

export async function getProductBySlug(
  db: DatabaseClient,
  slug: string
): Promise<ProductDetail | null> {
  const [product] = await db
    .select()
    .from(products)
    .where(
      and(eq(products.slug, slug), eq(products.status, "published"), isNull(products.deletedAt))
    )
    .limit(1);

  if (!product) {
    return null;
  }

  const [variants, images] = await Promise.all([
    db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.productId, product.id), isNull(productVariants.deletedAt)))
      .orderBy(asc(productVariants.title)),
    db
      .select()
      .from(productImages)
      .where(and(eq(productImages.productId, product.id), isNull(productImages.deletedAt)))
      .orderBy(asc(productImages.sortOrder))
  ]);

  const primaryImage = images[0];
  const primaryImageUrl = primaryImage ? resolveCatalogueImageUrl(primaryImage.url) : undefined;
  const summary = mapProductToSummary({
    ...product,
    variants,
    ...(primaryImageUrl ? { primaryImageUrl } : {})
  });

  return productDetailSchema.parse({
    ...summary,
    variants: variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku ?? undefined,
      price: {
        amount: variant.priceAmount,
        currencyCode: variant.currencyCode
      },
      isAvailable: variant.isAvailable
    })),
    images: images
      .map((image) => {
        const url = resolveCatalogueImageUrl(image.url);
        return url ? { url, altText: image.altText ?? undefined } : null;
      })
      .filter((image): image is NonNullable<typeof image> => image !== null)
  });
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
