import { Worker } from "bullmq";
import {
  runDailyPoBatchJob,
  runMarginCostRefreshJob,
  runOpsExceptionDetectionJob,
  runSupplierTrackingRequestJob,
  runTrackingIngestCheckJob
} from "@sjh/database";
import { createRedisConnectionOptions } from "../redis";

/**
 * Ops job workers default to dryRun=true (env OPS_JOBS_DRY_RUN, default true).
 * External email send remains disabled — supplier tracking job drafts only.
 */
export type OpsJobWorkerPayload = {
  dryRun?: boolean;
  batchDate?: string;
  limit?: number;
};

function resolveOpsDryRun(payloadDryRun?: boolean): boolean {
  if (process.env.OPS_JOBS_DRY_RUN === "false" && payloadDryRun === false) {
    return false;
  }
  // Default true; never enable outbound send from workers.
  return true;
}

export function createDailyPoBatchWorker(redisUrl: string): Worker<OpsJobWorkerPayload> {
  return new Worker<OpsJobWorkerPayload>(
    "ops:daily-po-batch",
    async (job) => {
      const dryRun = resolveOpsDryRun(job.data?.dryRun);
      return runDailyPoBatchJob(
        {
          dryRun,
          ...(job.data?.batchDate ? { batchDate: job.data.batchDate } : {})
        },
        process.env.DATABASE_URL
      );
    },
    {
      connection: createRedisConnectionOptions(redisUrl),
      concurrency: 1
    }
  );
}

export function createTrackingRequestWorker(redisUrl: string): Worker<OpsJobWorkerPayload> {
  return new Worker<OpsJobWorkerPayload>(
    "ops:tracking-request",
    async () => {
      // Always dry-run drafts — never send supplier email from worker.
      return runSupplierTrackingRequestJob({ dryRun: true }, process.env.DATABASE_URL);
    },
    {
      connection: createRedisConnectionOptions(redisUrl),
      concurrency: 1
    }
  );
}

export function createTrackingCheckWorker(redisUrl: string): Worker<OpsJobWorkerPayload> {
  return new Worker<OpsJobWorkerPayload>(
    "ops:tracking-check",
    async (job) => {
      const dryRun = resolveOpsDryRun(job.data?.dryRun);
      return runTrackingIngestCheckJob({ dryRun }, process.env.DATABASE_URL);
    },
    {
      connection: createRedisConnectionOptions(redisUrl),
      concurrency: 1
    }
  );
}

export function createExceptionDetectionWorker(redisUrl: string): Worker<OpsJobWorkerPayload> {
  return new Worker<OpsJobWorkerPayload>(
    "ops:exception-detection",
    async (job) => {
      const dryRun = resolveOpsDryRun(job.data?.dryRun);
      return runOpsExceptionDetectionJob({ dryRun }, process.env.DATABASE_URL);
    },
    {
      connection: createRedisConnectionOptions(redisUrl),
      concurrency: 1
    }
  );
}

export function createMarginRefreshWorker(redisUrl: string): Worker<OpsJobWorkerPayload> {
  return new Worker<OpsJobWorkerPayload>(
    "ops:margin-refresh",
    async (job) => {
      const dryRun = resolveOpsDryRun(job.data?.dryRun);
      return runMarginCostRefreshJob(
        {
          dryRun,
          ...(job.data?.limit !== undefined ? { limit: job.data.limit } : {})
        },
        process.env.DATABASE_URL
      );
    },
    {
      connection: createRedisConnectionOptions(redisUrl),
      concurrency: 1
    }
  );
}
