import { sql, eq, and, isNull } from "drizzle-orm";
import {
  collectionProducts,
  collections,
  createDatabaseClient,
  productImages,
  products,
  productVariants
} from "../index";
import { devCollections } from "./dev-collections";
import { DEV_CATALOG_SEED_TAG, devCatalogProducts } from "./dev-catalog";

export type SeedDevCatalogResult = {
  inserted: number;
  skipped: boolean;
};

export type SeedDevCollectionsResult = {
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

export async function seedDevCollections(databaseUrl: string): Promise<SeedDevCollectionsResult> {
  const db = createDatabaseClient(databaseUrl);

  const existing = await db
    .select({ id: collections.id })
    .from(collections)
    .where(sql`${collections.slug} = ${devCollections[0]!.slug}`)
    .limit(1);

  if (existing.length > 0) {
    return { inserted: 0, skipped: true };
  }

  let inserted = 0;

  for (const item of devCollections) {
    const [collection] = await db
      .insert(collections)
      .values({
        slug: item.slug,
        title: item.title,
        description: item.description,
        status: "published",
        createdBy: "dev-seed",
        updatedBy: "dev-seed"
      })
      .returning({ id: collections.id });

    if (!collection) {
      throw new Error(`Failed to insert dev collection ${item.slug}.`);
    }

    const leagueProducts = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(eq(products.league, item.league), eq(products.status, "published"), isNull(products.deletedAt))
      )
      .orderBy(products.title);

    for (const [index, product] of leagueProducts.entries()) {
      await db.insert(collectionProducts).values({
        collectionId: collection.id,
        productId: product.id,
        sortOrder: index
      });
    }

    inserted += 1;
  }

  return { inserted, skipped: false };
}
