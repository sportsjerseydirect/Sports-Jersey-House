import { Queue } from "bullmq";
import type { QueueName } from "./index";
import { createRedisConnectionOptions } from "./redis";

export type ShopifyExtractJobPayload = {
  databaseUrl: string;
  runId?: string;
  pageSize?: number;
};

export type ShopifyExtractCollectionsJobPayload = {
  databaseUrl: string;
  runId?: string;
  pageSize?: number;
};

const queueCache = new Map<QueueName, Queue>();

export function getQueue(name: QueueName, redisUrl?: string): Queue {
  const cached = queueCache.get(name);

  if (cached) {
    return cached;
  }

  const queue = new Queue(name, {
    connection: createRedisConnectionOptions(redisUrl ?? process.env.REDIS_URL!)
  });

  queueCache.set(name, queue);
  return queue;
}

export async function enqueueShopifyExtractPage(
  payload: ShopifyExtractJobPayload,
  redisUrl?: string
): Promise<string> {
  const queue = getQueue("shopify:extract", redisUrl);
  const job = await queue.add("extract-page", payload, {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 }
  });

  return job.id ?? "unknown";
}

export async function enqueueShopifyExtractCollectionsPage(
  payload: ShopifyExtractCollectionsJobPayload,
  redisUrl?: string
): Promise<string> {
  const queue = getQueue("shopify:extract-collections", redisUrl);
  const job = await queue.add("extract-collections-page", payload, {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 }
  });

  return job.id ?? "unknown";
}
