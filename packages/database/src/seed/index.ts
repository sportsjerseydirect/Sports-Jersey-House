import { sql } from "drizzle-orm";
import { createDatabaseClient, productImages, products, productVariants } from "../index";
import { DEV_CATALOG_SEED_TAG, devCatalogProducts } from "./dev-catalog";

export type SeedDevCatalogResult = {
  inserted: number;
  skipped: boolean;
};

export async function seedDevCatalog(databaseUrl: string): Promise<SeedDevCatalogResult> {
  const db = createDatabaseClient(databaseUrl);

  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(sql`${products.sourcePayload}->>'seedTag' = ${DEV_CATALOG_SEED_TAG}`)
    .limit(1);

  if (existing.length > 0) {
    return { inserted: 0, skipped: true };
  }

  for (const item of devCatalogProducts) {
    const [product] = await db
      .insert(products)
      .values({
        slug: item.slug,
        title: item.title,
        description: item.description,
        vendor: item.vendor,
        productType: item.productType,
        sport: item.sport,
        league: item.league,
        team: item.team,
        status: "published",
        sourcePayload: {
          seedTag: DEV_CATALOG_SEED_TAG,
          origin: "local-dev-seed"
        },
        createdBy: "dev-seed",
        updatedBy: "dev-seed"
      })
      .returning({ id: products.id });

    if (!product) {
      throw new Error(`Failed to insert dev product ${item.slug}.`);
    }

    await db.insert(productVariants).values({
      productId: product.id,
      sku: item.sku,
      title: item.variantTitle,
      priceAmount: item.priceAmount,
      currencyCode: item.currencyCode,
      inventoryQuantity: item.inventoryQuantity,
      isAvailable: item.inventoryQuantity > 0,
      createdBy: "dev-seed",
      updatedBy: "dev-seed"
    });

    await db.insert(productImages).values({
      productId: product.id,
      url: item.imagePath,
      altText: item.imageAlt,
      sortOrder: 0,
      createdBy: "dev-seed",
      updatedBy: "dev-seed"
    });
  }

  return { inserted: devCatalogProducts.length, skipped: false };
}
