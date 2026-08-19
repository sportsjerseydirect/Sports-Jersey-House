import {
  createDatabaseClient,
  fromExtractionCheckpoint,
  migrationCheckpoints,
  migrationRuns,
  toExtractionCheckpoint
} from "@sjh/database";
import { eq } from "drizzle-orm";
import type { ExtractionCheckpoint } from "@sjh/shared";
import {
  ShopifyReadOnlyClient,
  fetchProductsPage,
  parseShopifyConfig,
  type ShopifyConfig
} from "../index";
import { upsertShopifyProducts } from "../load/upsert-products";
import { mapShopifyProductToInternal } from "../mappers/shopify-to-internal";

export type ExtractProductsPageOptions = {
  databaseUrl: string;
  config?: ShopifyConfig;
  runId?: string;
  pageSize?: number;
};

export type ExtractProductsPageResult = {
  runId: string;
  checkpoint: ExtractionCheckpoint;
  fetched: number;
  upserted: number;
  errors: number;
  hasNextPage: boolean;
};

const PRODUCTS_RESOURCE = "products" as const;

export async function extractProductsPage(
  options: ExtractProductsPageOptions
): Promise<ExtractProductsPageResult> {
  const config = options.config ?? parseShopifyConfig(process.env);
  const pageSize = options.pageSize ?? 100;
  const db = createDatabaseClient(options.databaseUrl);
  const runId = options.runId ?? (await createMigrationRun(db));

  const checkpointRow = await getOrCreateCheckpoint(db, runId);
  const checkpoint = toExtractionCheckpoint(checkpointRow);

  if (checkpoint.completed) {
    return {
      runId,
      checkpoint,
      fetched: 0,
      upserted: 0,
      errors: 0,
      hasNextPage: false
    };
  }

  await db
    .update(migrationRuns)
    .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
    .where(eq(migrationRuns.id, runId));

  const client = new ShopifyReadOnlyClient(config);
  const response = await fetchProductsPage(client, checkpoint, pageSize);
  const nodes = response.products.edges.map((edge) => edge.node);
  const drafts = nodes.map(mapShopifyProductToInternal);
  const upsertResult = await upsertShopifyProducts(options.databaseUrl, drafts);

  const nextCheckpoint: ExtractionCheckpoint = {
    resource: PRODUCTS_RESOURCE,
    cursor: response.products.pageInfo.endCursor,
    completed: !response.products.pageInfo.hasNextPage,
    importedCount: checkpoint.importedCount + upsertResult.upserted
  };

  await saveCheckpoint(db, runId, nextCheckpoint);

  await db
    .update(migrationRuns)
    .set({
      status: nextCheckpoint.completed ? "completed" : "running",
      finishedAt: nextCheckpoint.completed ? new Date() : null,
      lastCheckpoint: nextCheckpoint,
      counters: { products: nextCheckpoint.importedCount },
      updatedAt: new Date()
    })
    .where(eq(migrationRuns.id, runId));

  return {
    runId,
    checkpoint: nextCheckpoint,
    fetched: nodes.length,
    upserted: upsertResult.upserted,
    errors: upsertResult.errors.length,
    hasNextPage: response.products.pageInfo.hasNextPage
  };
}

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

async function createMigrationRun(db: DatabaseClient): Promise<string> {
  const [run] = await db
    .insert(migrationRuns)
    .values({
      source: "shopify",
      status: "pending"
    })
    .returning({ id: migrationRuns.id });

  if (!run) {
    throw new Error("Failed to create migration run.");
  }

  return run.id;
}

async function getOrCreateCheckpoint(db: DatabaseClient, runId: string) {
  const existing = await db
    .select()
    .from(migrationCheckpoints)
    .where(eq(migrationCheckpoints.runId, runId));

  const productsCheckpoint = existing.find((row) => row.resource === PRODUCTS_RESOURCE);

  if (productsCheckpoint) {
    return productsCheckpoint;
  }

  const [created] = await db
    .insert(migrationCheckpoints)
    .values({
      runId,
      resource: PRODUCTS_RESOURCE,
      cursor: null,
      completed: false,
      payload: { importedCount: 0 }
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create migration checkpoint.");
  }

  return created;
}

async function saveCheckpoint(
  db: DatabaseClient,
  runId: string,
  checkpoint: ExtractionCheckpoint
): Promise<void> {
  const payload = fromExtractionCheckpoint(checkpoint);

  await db
    .insert(migrationCheckpoints)
    .values({
      runId,
      resource: payload.resource,
      cursor: payload.cursor,
      completed: payload.completed,
      payload: payload.payload
    })
    .onConflictDoUpdate({
      target: [migrationCheckpoints.runId, migrationCheckpoints.resource],
      set: {
        cursor: payload.cursor,
        completed: payload.completed,
        payload: payload.payload,
        updatedAt: new Date()
      }
    });
}
