import { Worker } from "bullmq";
import { extractProductsPage } from "@sjh/shopify";
import type { ShopifyExtractJobPayload } from "../queues";
import { createRedisConnectionOptions } from "../redis";

export function createShopifyExtractWorker(redisUrl: string): Worker<ShopifyExtractJobPayload> {
  return new Worker<ShopifyExtractJobPayload>(
    "shopify:extract",
    async (job) => {
      const options: Parameters<typeof extractProductsPage>[0] = {
        databaseUrl: job.data.databaseUrl
      };

      if (job.data.runId) {
        options.runId = job.data.runId;
      }

      if (job.data.pageSize !== undefined) {
        options.pageSize = job.data.pageSize;
      }

      const result = await extractProductsPage(options);

      return {
        runId: result.runId,
        fetched: result.fetched,
        upserted: result.upserted,
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
