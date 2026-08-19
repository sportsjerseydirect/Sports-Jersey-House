import {
  collectionProducts,
  collections,
  createDatabaseClient,
  products
} from "@sjh/database";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { InternalCollectionDraft } from "../mappers/shopify-collection-to-internal";

export type UpsertCollectionsResult = {
  upserted: number;
  memberships: number;
  errors: Array<{ shopifyId: string; message: string }>;
};

export async function upsertShopifyCollections(
  databaseUrl: string,
  drafts: InternalCollectionDraft[]
): Promise<UpsertCollectionsResult> {
  const db = createDatabaseClient(databaseUrl);
  let upserted = 0;
  let memberships = 0;
  const errors: UpsertCollectionsResult["errors"] = [];

  for (const draft of drafts) {
    try {
      const collectionId = await upsertCollection(db, draft);
      memberships += await syncCollectionProducts(db, collectionId, draft.productShopifyIds);
      upserted += 1;
    } catch (error) {
      errors.push({
        shopifyId: draft.shopifyId,
        message: error instanceof Error ? error.message : "Unknown upsert error"
      });
    }
  }

  return { upserted, memberships, errors };
}

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

async function upsertCollection(db: DatabaseClient, draft: InternalCollectionDraft): Promise<string> {
  const existing = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.shopifyId, draft.shopifyId), isNull(collections.deletedAt)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(collections)
      .set({
        slug: draft.slug,
        title: draft.title,
        description: draft.description,
        status: draft.status,
        sourcePayload: draft.sourcePayload,
        updatedBy: "shopify-extract",
        updatedAt: new Date()
      })
      .where(eq(collections.id, existing[0].id));

    return existing[0].id;
  }

  const [created] = await db
    .insert(collections)
    .values({
      shopifyId: draft.shopifyId,
      slug: draft.slug,
      title: draft.title,
      description: draft.description,
      status: draft.status,
      sourcePayload: draft.sourcePayload,
      createdBy: "shopify-extract",
      updatedBy: "shopify-extract"
    })
    .returning({ id: collections.id });

  if (!created) {
    throw new Error(`Failed to insert collection ${draft.shopifyId}.`);
  }

  return created.id;
}

async function syncCollectionProducts(
  db: DatabaseClient,
  collectionId: string,
  productShopifyIds: string[]
): Promise<number> {
  if (productShopifyIds.length === 0) {
    return 0;
  }

  const productRows = await db
    .select({ id: products.id, shopifyId: products.shopifyId })
    .from(products)
    .where(and(inArray(products.shopifyId, productShopifyIds), isNull(products.deletedAt)));

  const shopifyToProductId = new Map(
    productRows
      .filter((row): row is { id: string; shopifyId: string } => Boolean(row.shopifyId))
      .map((row) => [row.shopifyId, row.id])
  );

  await db.delete(collectionProducts).where(eq(collectionProducts.collectionId, collectionId));

  let linked = 0;

  for (const [index, shopifyId] of productShopifyIds.entries()) {
    const productId = shopifyToProductId.get(shopifyId);

    if (!productId) {
      continue;
    }

    await db.insert(collectionProducts).values({
      collectionId,
      productId,
      sortOrder: index
    });

    linked += 1;
  }

  return linked;
}
