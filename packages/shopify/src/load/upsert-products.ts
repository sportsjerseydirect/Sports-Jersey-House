import {
  createDatabaseClient,
  productImages,
  products,
  productVariants
} from "@sjh/database";
import { and, eq, isNull, notInArray } from "drizzle-orm";
import type { InternalProductDraft } from "../mappers/shopify-to-internal";

export type UpsertProductsResult = {
  upserted: number;
  productIds: string[];
  errors: Array<{ shopifyId: string; message: string }>;
};

const ALLOWED_IMPORT_STATUSES = new Set(["draft", "review", "approved", "archived"]);

function clampImportStatus(
  status: InternalProductDraft["status"]
): "draft" | "review" | "approved" | "archived" {
  if (status === "published" || !ALLOWED_IMPORT_STATUSES.has(status)) {
    return "draft";
  }
  return status as "draft" | "review" | "approved" | "archived";
}

export async function upsertShopifyProducts(
  databaseUrl: string,
  drafts: InternalProductDraft[]
): Promise<UpsertProductsResult> {
  const db = createDatabaseClient(databaseUrl);
  let upserted = 0;
  const productIds: string[] = [];
  const errors: UpsertProductsResult["errors"] = [];

  for (const draft of drafts) {
    try {
      const productId = await upsertSingleProduct(db, {
        ...draft,
        status: clampImportStatus(draft.status)
      });
      productIds.push(productId);
      upserted += 1;
    } catch (error) {
      errors.push({
        shopifyId: draft.shopifyId,
        message: error instanceof Error ? error.message : "Unknown upsert error"
      });
    }
  }

  return { upserted, productIds, errors };
}

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

async function upsertSingleProduct(db: DatabaseClient, draft: InternalProductDraft): Promise<string> {
  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.shopifyId, draft.shopifyId), isNull(products.deletedAt)))
    .limit(1);

  const productId = existing[0]?.id
    ? await updateProduct(db, existing[0].id, draft)
    : await insertProduct(db, draft);

  await syncVariants(db, productId, draft);
  await syncImages(db, productId, draft);
  return productId;
}

async function insertProduct(db: DatabaseClient, draft: InternalProductDraft): Promise<string> {
  const [row] = await db
    .insert(products)
    .values({
      shopifyId: draft.shopifyId,
      slug: draft.slug,
      title: draft.title,
      description: draft.description,
      vendor: draft.vendor,
      productType: draft.productType,
      sport: draft.sport,
      league: draft.league,
      team: draft.team,
      status: draft.status,
      sourcePayload: draft.sourcePayload,
      createdBy: "shopify-extract",
      updatedBy: "shopify-extract"
    })
    .returning({ id: products.id });

  if (!row) {
    throw new Error(`Failed to insert product ${draft.shopifyId}.`);
  }

  return row.id;
}

async function updateProduct(
  db: DatabaseClient,
  productId: string,
  draft: InternalProductDraft
): Promise<string> {
  await db
    .update(products)
    .set({
      slug: draft.slug,
      title: draft.title,
      description: draft.description,
      vendor: draft.vendor,
      productType: draft.productType,
      sport: draft.sport,
      league: draft.league,
      team: draft.team,
      status: draft.status,
      sourcePayload: draft.sourcePayload,
      updatedBy: "shopify-extract",
      updatedAt: new Date()
    })
    .where(eq(products.id, productId));

  return productId;
}

async function syncVariants(db: DatabaseClient, productId: string, draft: InternalProductDraft): Promise<void> {
  const incomingIds = draft.variants.map((variant) => variant.shopifyId);

  if (incomingIds.length > 0) {
    await db
      .update(productVariants)
      .set({ deletedAt: new Date(), updatedBy: "shopify-extract" })
      .where(
        and(
          eq(productVariants.productId, productId),
          isNull(productVariants.deletedAt),
          notInArray(productVariants.shopifyId, incomingIds)
        )
      );
  }

  for (const variant of draft.variants) {
    const existing = await db
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(and(eq(productVariants.shopifyId, variant.shopifyId), isNull(productVariants.deletedAt)))
      .limit(1);

    if (existing[0]) {
      await db
        .update(productVariants)
        .set({
          sku: variant.sku,
          title: variant.title,
          priceAmount: variant.priceAmount,
          compareAtAmount: variant.compareAtAmount,
          currencyCode: variant.currencyCode,
          inventoryQuantity: variant.inventoryQuantity,
          isAvailable: variant.isAvailable,
          options: variant.options,
          updatedBy: "shopify-extract",
          updatedAt: new Date()
        })
        .where(eq(productVariants.id, existing[0].id));
      continue;
    }

    await db.insert(productVariants).values({
      productId,
      shopifyId: variant.shopifyId,
      sku: variant.sku,
      title: variant.title,
      priceAmount: variant.priceAmount,
      compareAtAmount: variant.compareAtAmount,
      currencyCode: variant.currencyCode,
      inventoryQuantity: variant.inventoryQuantity,
      isAvailable: variant.isAvailable,
      options: variant.options,
      createdBy: "shopify-extract",
      updatedBy: "shopify-extract"
    });
  }
}

async function syncImages(db: DatabaseClient, productId: string, draft: InternalProductDraft): Promise<void> {
  const existingImages = await db
    .select({ id: productImages.id, sourceUrl: productImages.sourceUrl })
    .from(productImages)
    .where(and(eq(productImages.productId, productId), isNull(productImages.deletedAt)));

  const incomingSourceUrls = new Set(draft.images.map((image) => image.sourceUrl));

  for (const image of existingImages) {
    if (image.sourceUrl && !incomingSourceUrls.has(image.sourceUrl)) {
      await db
        .update(productImages)
        .set({ deletedAt: new Date(), updatedBy: "shopify-extract" })
        .where(eq(productImages.id, image.id));
    }
  }

  for (const image of draft.images) {
    const existing = existingImages.find((row) => row.sourceUrl === image.sourceUrl);

    if (existing) {
      await db
        .update(productImages)
        .set({
          url: image.url,
          altText: image.altText,
          sortOrder: image.sortOrder,
          width: image.width,
          height: image.height,
          updatedBy: "shopify-extract",
          updatedAt: new Date()
        })
        .where(eq(productImages.id, existing.id));
      continue;
    }

    await db.insert(productImages).values({
      productId,
      url: image.url,
      altText: image.altText,
      sortOrder: image.sortOrder,
      sourceUrl: image.sourceUrl,
      width: image.width,
      height: image.height,
      createdBy: "shopify-extract",
      updatedBy: "shopify-extract"
    });
  }
}
