import { createDatabaseClient, migrationRuns } from "@sjh/database";
import { eq } from "drizzle-orm";
import type { ExtractionCheckpoint } from "@sjh/shared";
import {
  ShopifyReadOnlyClient,
  fetchCollectionsPage,
  parseShopifyConfig,
  type ShopifyConfig
} from "../index";
import { upsertShopifyCollections } from "../load/upsert-collections";
import { mapShopifyCollectionToInternal } from "../mappers/shopify-collection-to-internal";
import {
  createMigrationRun,
  getOrCreateCheckpoint,
  markRunProgress,
  saveCheckpoint,
  toExtractionCheckpoint
} from "./run-state";

export type ExtractCollectionsPageOptions = {
  databaseUrl: string;
  config?: ShopifyConfig;
  runId?: string;
  pageSize?: number;
};

export type ExtractCollectionsPageResult = {
  runId: string;
  checkpoint: ExtractionCheckpoint;
  fetched: number;
  upserted: number;
  memberships: number;
  errors: number;
  hasNextPage: boolean;
};

const COLLECTIONS_RESOURCE = "collections" as const;

export async function extractCollectionsPage(
  options: ExtractCollectionsPageOptions
): Promise<ExtractCollectionsPageResult> {
  const config = options.config ?? parseShopifyConfig(process.env);
  const pageSize = options.pageSize ?? 50;
  const db = createDatabaseClient(options.databaseUrl);
  const runId = options.runId ?? (await createMigrationRun(db));

  const checkpointRow = await getOrCreateCheckpoint(db, runId, COLLECTIONS_RESOURCE);
  const checkpoint = toExtractionCheckpoint(checkpointRow);

  if (checkpoint.completed) {
    return {
      runId,
      checkpoint,
      fetched: 0,
      upserted: 0,
      memberships: 0,
      errors: 0,
      hasNextPage: false
    };
  }

  await db
    .update(migrationRuns)
    .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
    .where(eq(migrationRuns.id, runId));

  const client = new ShopifyReadOnlyClient(config);
  const response = await fetchCollectionsPage(client, checkpoint, pageSize);
  const nodes = response.collections.edges.map((edge) => edge.node);
  const drafts = nodes.map(mapShopifyCollectionToInternal);
  const upsertResult = await upsertShopifyCollections(options.databaseUrl, drafts);

  const nextCheckpoint: ExtractionCheckpoint = {
    resource: COLLECTIONS_RESOURCE,
    cursor: response.collections.pageInfo.endCursor,
    completed: !response.collections.pageInfo.hasNextPage,
    importedCount: checkpoint.importedCount + upsertResult.upserted
  };

  await saveCheckpoint(db, runId, nextCheckpoint);
  await markRunProgress(db, runId, nextCheckpoint, { collections: nextCheckpoint.importedCount });

  return {
    runId,
    checkpoint: nextCheckpoint,
    fetched: nodes.length,
    upserted: upsertResult.upserted,
    memberships: upsertResult.memberships,
    errors: upsertResult.errors.length,
    hasNextPage: response.collections.pageInfo.hasNextPage
  };
}
