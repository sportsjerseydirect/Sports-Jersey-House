import { Worker } from "bullmq";
import { extractCollectionsPage } from "@sjh/shopify";
import type { ShopifyExtractCollectionsJobPayload } from "../queues";
import { createRedisConnectionOptions } from "../redis";

export function createShopifyExtractCollectionsWorker(
  redisUrl: string
): Worker<ShopifyExtractCollectionsJobPayload> {
  return new Worker<ShopifyExtractCollectionsJobPayload>(
    "shopify:extract-collections",
    async (job) => {
      const options: Parameters<typeof extractCollectionsPage>[0] = {
        databaseUrl: job.data.databaseUrl
      };

      if (job.data.runId) {
        options.runId = job.data.runId;
      }

      if (job.data.pageSize !== undefined) {
        options.pageSize = job.data.pageSize;
      }

      const result = await extractCollectionsPage(options);

      return {
        runId: result.runId,
        fetched: result.fetched,
        upserted: result.upserted,
        memberships: result.memberships,
        errors: result.errors,
        completed: result.checkpoint.completed,
        hasNextPage: result.hasNextPage
      };
    },
    {
      connection: createRedisConnectionOptions(redisUrl),
      concurrency: 1
    }
  );
}
