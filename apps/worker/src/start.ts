import { queueNames } from "./index";
import { resolveRedisUrl } from "./redis";
import { createShopifyExtractWorker } from "./workers/shopify-extract";

async function main(): Promise<void> {
  const redisUrl = resolveRedisUrl();
  const workers = [createShopifyExtractWorker(redisUrl)];

  console.log(`Worker started — listening on ${queueNames.filter((name) => name === "shopify:extract").join(", ")}`);

  for (const worker of workers) {
    worker.on("completed", (job, result) => {
      console.log(`[${job.queueName}] ${job.id} completed`, result);
    });

    worker.on("failed", (job, error) => {
      console.error(`[${job?.queueName}] ${job?.id} failed`, error.message);
    });
  }

  const shutdown = async () => {
    await Promise.all(workers.map((worker) => worker.close()));
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Worker failed to start.");
  process.exitCode = 1;
});
