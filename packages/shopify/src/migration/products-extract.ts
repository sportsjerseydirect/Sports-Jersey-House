import { createDatabaseClient, migrationRuns } from "@sjh/database";
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
import {
  createMigrationRun,
  getOrCreateCheckpoint,
  markRunProgress,
  saveCheckpoint,
  toExtractionCheckpoint
} from "./run-state";

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

  const checkpointRow = await getOrCreateCheckpoint(db, runId, PRODUCTS_RESOURCE);
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
  await markRunProgress(db, runId, nextCheckpoint, { products: nextCheckpoint.importedCount });

  return {
    runId,
    checkpoint: nextCheckpoint,
    fetched: nodes.length,
    upserted: upsertResult.upserted,
    errors: upsertResult.errors.length,
    hasNextPage: response.products.pageInfo.hasNextPage
  };
}
