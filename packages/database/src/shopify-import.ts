import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
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
  sampleImportEnabled: boolean;
  fullImportEnabled: boolean;
  status: "ready" | "gated" | "missing_credentials";
  message: string;
};

export type ShopifyImportRunSnapshot = {
  id: string;
  mode: string;
  status: string;
  sampleLimit: number | null;
  cursor: string | null;
  productsFetched: number;
  productsStaged: number;
  errorsCount: number;
  dryRun: boolean;
  syncGateEnabled: boolean;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type StagedProductResult = {
  rawId: string;
  stagedId: string;
  shopifyProductId: string;
  /** Present for SOURCE_MATCH (same Shopify id) or POSSIBLE_DUPLICATE (slug overlap). */
  matchedProductId: string | null;
  matchKind: "SOURCE_MATCH" | "POSSIBLE_DUPLICATE" | null;
  /** Only set for POSSIBLE_DUPLICATE — never for SOURCE_MATCH rematches. */
  duplicateOfProductId: string | null;
  duplicateScore: string | null;
};

export type ShopifyImportReport = {
  run: ShopifyImportRunSnapshot;
  health: ShopifyConnectionHealth;
  liveFetchAllowed: boolean;
};

/**
 * Read env gates only. Does not call Shopify Admin/Storefront APIs.
 * Live fetch requires ENABLE_SHOPIFY_SYNC=true OR ENABLE_SHOPIFY_SAMPLE_IMPORT=true.
 * When gated, dry_run can accept manually provided sample payloads via stageNormalizedProduct only.
 */
export function getShopifyConnectionHealth(): ShopifyConnectionHealth {
  const domain = Boolean(process.env.SHOPIFY_STORE_DOMAIN?.trim());
  const clientId = Boolean(process.env.SHOPIFY_CLIENT_ID?.trim());
  const clientSecret = Boolean(process.env.SHOPIFY_CLIENT_SECRET?.trim());
  const credentialsPresent = domain && clientId && clientSecret;
  const syncEnabled = process.env.ENABLE_SHOPIFY_SYNC === "true";
  const sampleImportEnabled = process.env.ENABLE_SHOPIFY_SAMPLE_IMPORT === "true";
  const fullImportEnabled = process.env.ENABLE_SHOPIFY_FULL_IMPORT === "true";
  const readAllowed = syncEnabled || sampleImportEnabled || fullImportEnabled;

  if (!credentialsPresent) {
    return {
      credentialsPresent: false,
      syncEnabled,
      sampleImportEnabled,
      fullImportEnabled,
      status: "missing_credentials",
      message:
        "Shopify credentials missing. Set SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID, and SHOPIFY_CLIENT_SECRET."
    };
  }

  if (!readAllowed) {
    return {
      credentialsPresent: true,
      syncEnabled: false,
      sampleImportEnabled: false,
      fullImportEnabled: false,
      status: "gated",
      message:
        "Shopify read gated. Set ENABLE_SHOPIFY_SAMPLE_IMPORT=true for controlled sample imports, ENABLE_SHOPIFY_FULL_IMPORT=true for full catalogue import, or ENABLE_SHOPIFY_SYNC=true after full migration approval. Dry-run staging accepts manual sample payloads only — no live API fetch."
    };
  }

  return {
    credentialsPresent: true,
    syncEnabled,
    sampleImportEnabled,
    fullImportEnabled,
    status: "ready",
    message: fullImportEnabled && !syncEnabled
      ? "Shopify full import enabled and credentials present. Read-only full catalogue fetch permitted."
      : sampleImportEnabled && !syncEnabled
        ? "Shopify sample import enabled and credentials present. Read-only live sample fetch permitted (full sync remains off)."
        : "Shopify sync/sample read enabled and credentials present. Live fetch permitted by gate."
  };
}

function mapImportRun(row: typeof shopifyImportRuns.$inferSelect): ShopifyImportRunSnapshot {
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    sampleLimit: row.sampleLimit,
    cursor: row.cursor,
    productsFetched: row.productsFetched,
    productsStaged: row.productsStaged,
    errorsCount: row.errorsCount,
    dryRun: row.dryRun,
    syncGateEnabled: row.syncGateEnabled,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    errorMessage: row.errorMessage,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt
  };
}

export async function createImportRun(
  input: { mode: "dry_run" | "sample" | "full"; sampleLimit?: number },
  databaseUrl?: string
): Promise<ShopifyImportRunSnapshot> {
  const health = getShopifyConnectionHealth();
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const liveFetchAllowed = health.status === "ready";
  // Sample/full mode is a live read-only import when any read gate is on; otherwise dry-run staging only.
  const dryRun =
    input.mode === "dry_run" ||
    !(health.sampleImportEnabled || health.syncEnabled || health.fullImportEnabled);

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
        sampleImportEnabled: health.sampleImportEnabled,
        liveFetchAllowed,
        note:
          health.status === "gated"
            ? "Live fetch blocked; stageNormalizedProduct accepts manual payloads only."
            : input.mode === "full"
              ? "Controlled full catalogue import run started (read-only)."
              : input.mode === "sample"
                ? "Controlled sample import run started (read-only)."
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

export async function getImportRun(
  runId: string,
  databaseUrl?: string
): Promise<ShopifyImportRunSnapshot | null> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [row] = await db
    .select()
    .from(shopifyImportRuns)
    .where(eq(shopifyImportRuns.id, runId))
    .limit(1);
  return row ? mapImportRun(row) : null;
}

export async function finishImportRun(
  runId: string,
  input: {
    status: "succeeded" | "failed" | "cancelled";
    productsFetched?: number;
    productsStaged?: number;
    errorsCount?: number;
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
    cursor?: string | null;
  },
  databaseUrl?: string
): Promise<ShopifyImportRunSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const existing = await getImportRun(runId, databaseUrl);
  if (!existing) {
    throw new Error("Import run not found.");
  }

  const [updated] = await db
    .update(shopifyImportRuns)
    .set({
      status: input.status,
      finishedAt: new Date(),
      updatedAt: new Date(),
      ...(input.productsFetched !== undefined ? { productsFetched: input.productsFetched } : {}),
      ...(input.productsStaged !== undefined ? { productsStaged: input.productsStaged } : {}),
      ...(input.errorsCount !== undefined ? { errorsCount: input.errorsCount } : {}),
      ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      metadata: {
        ...existing.metadata,
        ...(input.metadata ?? {})
      }
    })
    .where(eq(shopifyImportRuns.id, runId))
    .returning();

  if (!updated) {
    throw new Error("Failed to finish Shopify import run.");
  }

  return mapImportRun(updated);
}

export async function updateImportRunProgress(
  runId: string,
  input: {
    productsFetched?: number;
    productsStaged?: number;
    errorsCount?: number;
    cursor?: string | null;
    metadata?: Record<string, unknown>;
  },
  databaseUrl?: string
): Promise<void> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const existing = await getImportRun(runId, databaseUrl);
  if (!existing) {
    throw new Error("Import run not found.");
  }

  await db
    .update(shopifyImportRuns)
    .set({
      status: "running",
      updatedAt: new Date(),
      ...(input.productsFetched !== undefined ? { productsFetched: input.productsFetched } : {}),
      ...(input.productsStaged !== undefined ? { productsStaged: input.productsStaged } : {}),
      ...(input.errorsCount !== undefined ? { errorsCount: input.errorsCount } : {}),
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      metadata: {
        ...existing.metadata,
        ...(input.metadata ?? {})
      }
    })
    .where(eq(shopifyImportRuns.id, runId));
}

export async function getResumableFullImportRun(
  databaseUrl?: string,
  explicitRunId?: string
): Promise<{ run: ShopifyImportRunSnapshot; cursor: string | null } | null> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  if (explicitRunId) {
    const [row] = await db
      .select()
      .from(shopifyImportRuns)
      .where(eq(shopifyImportRuns.id, explicitRunId))
      .limit(1);
    if (row && row.mode === "full" && row.status !== "succeeded" && row.status !== "cancelled") {
      const run = mapImportRun(row);
      await db
        .update(shopifyImportRuns)
        .set({ status: "running", finishedAt: null, updatedAt: new Date() })
        .where(eq(shopifyImportRuns.id, row.id));
      return { run, cursor: row.cursor };
    }
    return null;
  }

  const [row] = await db
    .select()
    .from(shopifyImportRuns)
    .where(
      and(
        eq(shopifyImportRuns.mode, "full"),
        inArray(shopifyImportRuns.status, ["running", "failed"])
      )
    )
    .orderBy(desc(shopifyImportRuns.startedAt))
    .limit(1);

  if (!row) return null;
  await db
    .update(shopifyImportRuns)
    .set({ status: "running", finishedAt: null, updatedAt: new Date() })
    .where(eq(shopifyImportRuns.id, row.id));
  return { run: mapImportRun(row), cursor: row.cursor };
}

export function buildImportReport(
  run: ShopifyImportRunSnapshot,
  health = getShopifyConnectionHealth()
): ShopifyImportReport {
  return {
    run,
    health,
    liveFetchAllowed: health.status === "ready"
  };
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

  const matchKind = byShopify
    ? ("SOURCE_MATCH" as const)
    : bySlug
      ? ("POSSIBLE_DUPLICATE" as const)
      : null;
  const matchedProductId = byShopify?.id ?? bySlug?.id ?? null;
  // SOURCE_MATCH is identity rematch of the same Shopify product — not a catalogue duplicate.
  const duplicateOfProductId = matchKind === "POSSIBLE_DUPLICATE" ? matchedProductId : null;
  const duplicateScore =
    matchKind === "POSSIBLE_DUPLICATE" ? "90.00" : matchKind === "SOURCE_MATCH" ? null : null;

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
      matchKind,
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
        matchKind,
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
    matchedProductId,
    matchKind,
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
