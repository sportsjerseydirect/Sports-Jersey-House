import {
  collectionProducts,
  collections,
  createDatabaseClient,
  products
} from "@sjh/database";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

export type SyncProductCollectionMembershipsResult = {
  productsScanned: number;
  collectionsUpserted: number;
  membershipsWritten: number;
  skippedMissingCollectionRefs: number;
};

type SourceCollectionRef = {
  id?: string;
  handle?: string;
  title?: string;
};

/**
 * Idempotently link SJH products to SJH collections using each product's
 * sourcePayload.collections (from Shopify product GraphQL).
 * Does not fetch Shopify and does not import additional products.
 */
export async function syncProductCollectionMembershipsFromSourcePayload(
  databaseUrl: string,
  options: { productIds?: string[] } = {}
): Promise<SyncProductCollectionMembershipsResult> {
  const db = createDatabaseClient(databaseUrl);

  const conditions = [isNull(products.deletedAt), sql`${products.shopifyId} is not null`];
  if (options.productIds?.length) {
    conditions.push(inArray(products.id, options.productIds));
  }

  const scoped = await db
    .select({
      id: products.id,
      shopifyId: products.shopifyId,
      sourcePayload: products.sourcePayload
    })
    .from(products)
    .where(and(...conditions));

  let collectionsUpserted = 0;
  let membershipsWritten = 0;
  let skippedMissingCollectionRefs = 0;
  const collectionIdByShopifyId = new Map<string, string>();

  async function ensureCollection(ref: SourceCollectionRef): Promise<string | null> {
    const shopifyId = ref.id?.trim();
    if (!shopifyId) {
      return null;
    }
    const cached = collectionIdByShopifyId.get(shopifyId);
    if (cached) {
      return cached;
    }

    const [existing] = await db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.shopifyId, shopifyId), isNull(collections.deletedAt)))
      .limit(1);

    if (existing) {
      collectionIdByShopifyId.set(shopifyId, existing.id);
      return existing.id;
    }

    const handle = (ref.handle?.trim() || shopifyId.split("/").pop() || shopifyId).toLowerCase();
    const title = ref.title?.trim() || handle;

    const [created] = await db
      .insert(collections)
      .values({
        shopifyId,
        slug: handle,
        title,
        description: null,
        status: "draft",
        sourcePayload: {
          origin: "shopify-product-collection-ref",
          linkedFromProductCollections: true
        },
        createdBy: "shopify-membership-sync",
        updatedBy: "shopify-membership-sync"
      })
      .returning({ id: collections.id });

    if (!created) {
      return null;
    }

    collectionsUpserted += 1;
    collectionIdByShopifyId.set(shopifyId, created.id);
    return created.id;
  }

  for (const product of scoped) {
    const payload = (product.sourcePayload ?? {}) as Record<string, unknown>;
    const refs = Array.isArray(payload.collections)
      ? (payload.collections as SourceCollectionRef[])
      : [];

    if (refs.length === 0) {
      skippedMissingCollectionRefs += 1;
      continue;
    }

    let sortOrder = 0;
    for (const ref of refs) {
      const collectionId = await ensureCollection(ref);
      if (!collectionId) {
        skippedMissingCollectionRefs += 1;
        continue;
      }

      await db
        .insert(collectionProducts)
        .values({
          collectionId,
          productId: product.id,
          sortOrder
        })
        .onConflictDoUpdate({
          target: [collectionProducts.collectionId, collectionProducts.productId],
          set: { sortOrder }
        });

      membershipsWritten += 1;
      sortOrder += 1;
    }
  }

  return {
    productsScanned: scoped.length,
    collectionsUpserted,
    membershipsWritten,
    skippedMissingCollectionRefs
  };
}
