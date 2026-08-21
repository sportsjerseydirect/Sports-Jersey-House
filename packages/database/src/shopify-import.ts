import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { createDatabaseClient } from "./client";
import { products } from "./schema-catalogue";
import {
  shopifyImportRaw,
  shopifyImportRuns,
  shopifyImportStagedProducts
} from "./schema-ops";

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for Shopify import operations.");
  }
  return url;
}

export type ShopifyConnectionHealth = {
  credentialsPresent: boolean;
  syncEnabled: boolean;
  status: "ready" | "gated" | "missing_credentials";
  message: string;
};

export type ShopifyImportRunSnapshot = {
  id: string;
  mode: string;
  status: string;
  sampleLimit: number | null;
  productsFetched: number;
  productsStaged: number;
  errorsCount: number;
  dryRun: boolean;
  syncGateEnabled: boolean;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
};

export type StagedProductResult = {
  rawId: string;
  stagedId: string;
  shopifyProductId: string;
  duplicateOfProductId: string | null;
  duplicateScore: string | null;
};

/**
 * Read env gates only. Does not call Shopify Admin/Storefront APIs when sync is disabled.
 * Live fetch requires ENABLE_SHOPIFY_SYNC=true; when gated, dry_run can accept manually
 * provided sample payloads via stageNormalizedProduct only.
 */
export function getShopifyConnectionHealth(): ShopifyConnectionHealth {
  const domain = Boolean(process.env.SHOPIFY_STORE_DOMAIN?.trim());
  const clientId = Boolean(process.env.SHOPIFY_CLIENT_ID?.trim());
  const clientSecret = Boolean(process.env.SHOPIFY_CLIENT_SECRET?.trim());
  const credentialsPresent = domain && clientId && clientSecret;
  const syncEnabled = process.env.ENABLE_SHOPIFY_SYNC === "true";

  if (!credentialsPresent) {
    return {
      credentialsPresent: false,
      syncEnabled,
      status: "missing_credentials",
      message:
        "Shopify credentials missing. Set SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, and SHOPIFY_CLIENT_SECRET."
    };
  }

  if (!syncEnabled) {
    return {
      credentialsPresent: true,
      syncEnabled: false,
      status: "gated",
      message:
        "Shopify sync gated (ENABLE_SHOPIFY_SYNC!=true). Dry-run staging accepts manual sample payloads only — no live API fetch."
    };
  }

  return {
    credentialsPresent: true,
    syncEnabled: true,
    status: "ready",
    message: "Shopify sync enabled and credentials present. Live fetch permitted by gate."
  };
}

function mapImportRun(row: typeof shopifyImportRuns.$inferSelect): ShopifyImportRunSnapshot {
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    sampleLimit: row.sampleLimit,
    productsFetched: row.productsFetched,
    productsStaged: row.productsStaged,
    errorsCount: row.errorsCount,
    dryRun: row.dryRun,
    syncGateEnabled: row.syncGateEnabled,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt
  };
}

export async function createImportRun(
  input: { mode: "dry_run" | "sample"; sampleLimit?: number },
  databaseUrl?: string
): Promise<ShopifyImportRunSnapshot> {
  const health = getShopifyConnectionHealth();
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const dryRun = input.mode === "dry_run" || !health.syncEnabled;

  const [created] = await db
    .insert(shopifyImportRuns)
    .values({
      mode: input.mode,
      status: "running",
      dryRun,
      syncGateEnabled: health.syncEnabled,
      startedAt: new Date(),
      metadata: {
        connectionStatus: health.status,
        note:
          health.status === "gated"
            ? "Live fetch blocked; stageNormalizedProduct accepts manual payloads only."
            : "Import run started."
      },
      ...(input.sampleLimit !== undefined ? { sampleLimit: input.sampleLimit } : {})
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create Shopify import run.");
  }

  return mapImportRun(created);
}

export async function stageNormalizedProduct(
  runId: string,
  input: {
    shopifyProductId: string;
    title: string;
    handle: string;
    status: string;
    vendor?: string;
    productType?: string;
    payload: Record<string, unknown>;
    normalized: Record<string, unknown>;
  },
  databaseUrl?: string
): Promise<StagedProductResult> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));

  const [run] = await db
    .select()
    .from(shopifyImportRuns)
    .where(eq(shopifyImportRuns.id, runId))
    .limit(1);

  if (!run) {
    throw new Error("Import run not found.");
  }

  const shopifyProductId = input.shopifyProductId.trim();
  const handle = input.handle.trim();

  const [byShopify] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.shopifyId, shopifyProductId), isNull(products.deletedAt)))
    .limit(1);

  const [bySlug] = byShopify
    ? [undefined]
    : await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.slug, handle), isNull(products.deletedAt)))
        .limit(1);

  const duplicateOfProductId = byShopify?.id ?? bySlug?.id ?? null;
  const duplicateScore = duplicateOfProductId ? (byShopify ? "100.00" : "90.00") : null;

  const [raw] = await db
    .insert(shopifyImportRaw)
    .values({
      runId,
      shopifyProductId,
      payload: input.payload
    })
    .onConflictDoUpdate({
      target: [shopifyImportRaw.runId, shopifyImportRaw.shopifyProductId],
      set: {
        payload: input.payload,
        fetchedAt: new Date()
      }
    })
    .returning();

  if (!raw) {
    throw new Error("Failed to write raw Shopify import payload.");
  }

  const [staged] = await db
    .insert(shopifyImportStagedProducts)
    .values({
      runId,
      shopifyProductId,
      title: input.title,
      handle,
      status: input.status,
      vendor: input.vendor ?? null,
      productType: input.productType ?? null,
      normalized: input.normalized,
      duplicateOfProductId,
      duplicateScore
    })
    .onConflictDoUpdate({
      target: [shopifyImportStagedProducts.runId, shopifyImportStagedProducts.shopifyProductId],
      set: {
        title: input.title,
        handle,
        status: input.status,
        vendor: input.vendor ?? null,
        productType: input.productType ?? null,
        normalized: input.normalized,
        duplicateOfProductId,
        duplicateScore,
        updatedAt: new Date()
      }
    })
    .returning();

  if (!staged) {
    throw new Error("Failed to stage normalized Shopify product.");
  }

  await db
    .update(shopifyImportRuns)
    .set({
      productsFetched: sql`${shopifyImportRuns.productsFetched} + 1`,
      productsStaged: sql`${shopifyImportRuns.productsStaged} + 1`,
      updatedAt: new Date()
    })
    .where(eq(shopifyImportRuns.id, runId));

  return {
    rawId: raw.id,
    stagedId: staged.id,
    shopifyProductId,
    duplicateOfProductId,
    duplicateScore
  };
}

export async function listImportRuns(
  limit = 50,
  databaseUrl?: string
): Promise<ShopifyImportRunSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db
    .select()
    .from(shopifyImportRuns)
    .orderBy(desc(shopifyImportRuns.createdAt))
    .limit(limit);
  return rows.map(mapImportRun);
}
