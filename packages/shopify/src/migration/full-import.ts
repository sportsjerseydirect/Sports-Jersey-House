/**
 * Read-only full catalogue import — gated by ENABLE_SHOPIFY_FULL_IMPORT=true.
 * ENABLE_SHOPIFY_SYNC must remain false. Products stay draft; no SJD writes.
 *
 * Resumable via shopify_import_runs.cursor + status=running.
 */
import {
  createImportRun,
  finishImportRun,
  getImportRun,
  getResumableFullImportRun,
  updateImportRunProgress
} from "@sjh/database";
import {
  fetchProductsPage,
  isShopifyReadAllowed,
  parseShopifyConfig,
  ShopifyReadOnlyClient,
  testShopifyConnection,
  type ShopifyConfig,
  type ShopifyProductNode
} from "../index";
import { upsertShopifyProducts } from "../load/upsert-products";
import { mapShopifyProductForSampleImport } from "../mappers/shopify-to-internal";

export type FullImportReport = {
  ok: boolean;
  runId: string | null;
  productsFetched: number;
  productsUpserted: number;
  productsUpdated: number;
  productsNew: number;
  productsSkipped: number;
  productsFailed: number;
  pagesProcessed: number;
  completed: boolean;
  resumed: boolean;
  durationMs: number;
  errors: Array<{ shopifyId?: string; message: string; retryCount?: number }>;
  message: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findResumableRun(databaseUrl: string, explicitRunId?: string) {
  return getResumableFullImportRun(databaseUrl, explicitRunId);
}

async function flushBatch(
  databaseUrl: string,
  nodes: ShopifyProductNode[],
  errors: FullImportReport["errors"]
): Promise<{ upserted: number; failed: number }> {
  if (nodes.length === 0) return { upserted: 0, failed: 0 };
  const drafts = nodes.map((node) => mapShopifyProductForSampleImport(node));
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await upsertShopifyProducts(databaseUrl, drafts, {
        skipMediaSyncForExisting: true
      });
      for (const err of result.errors) {
        errors.push({ shopifyId: err.shopifyId, message: err.message, retryCount: attempt - 1 });
      }
      return { upserted: result.upserted, failed: result.errors.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Batch upsert failed";
      if (attempt === maxAttempts) {
        errors.push({ message, retryCount: attempt });
        return { upserted: 0, failed: nodes.length };
      }
      await sleep(1000 * attempt);
    }
  }
  return { upserted: 0, failed: nodes.length };
}

export async function runControlledFullImport(options: {
  databaseUrl: string;
  pageSize?: number;
  delayMs?: number;
  config?: ShopifyConfig;
  resumeRunId?: string;
  maxPages?: number;
}): Promise<FullImportReport> {
  const started = Date.now();
  const pageSize = Math.min(Math.max(options.pageSize ?? 50, 10), 100);
  const delayMs = options.delayMs ?? Number.parseInt(process.env.SHOPIFY_EXTRACT_DELAY_MS ?? "500", 10);
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;
  const errors: FullImportReport["errors"] = [];

  let config: ShopifyConfig;
  try {
    config = options.config ?? parseShopifyConfig(process.env);
  } catch (error) {
    return {
      ok: false,
      runId: null,
      productsFetched: 0,
      productsUpserted: 0,
      productsUpdated: 0,
      productsNew: 0,
      productsSkipped: 0,
      productsFailed: 0,
      pagesProcessed: 0,
      completed: false,
      resumed: false,
      durationMs: Date.now() - started,
      errors: [{ message: error instanceof Error ? error.message : "Invalid config" }],
      message: "Full import aborted: invalid Shopify config."
    };
  }

  if (!config.enableShopifyFullImport) {
    return {
      ok: false,
      runId: null,
      productsFetched: 0,
      productsUpserted: 0,
      productsUpdated: 0,
      productsNew: 0,
      productsSkipped: 0,
      productsFailed: 0,
      pagesProcessed: 0,
      completed: false,
      resumed: false,
      durationMs: Date.now() - started,
      errors: [{ message: "ENABLE_SHOPIFY_FULL_IMPORT is not true." }],
      message: "Full import blocked. Set ENABLE_SHOPIFY_FULL_IMPORT=true (keep ENABLE_SHOPIFY_SYNC=false)."
    };
  }

  if (config.enableShopifySync) {
    return {
      ok: false,
      runId: null,
      productsFetched: 0,
      productsUpserted: 0,
      productsUpdated: 0,
      productsNew: 0,
      productsSkipped: 0,
      productsFailed: 0,
      pagesProcessed: 0,
      completed: false,
      resumed: false,
      durationMs: Date.now() - started,
      errors: [{ message: "ENABLE_SHOPIFY_SYNC must remain false for read-only full import." }],
      message: "Full import blocked: sync gate must stay off."
    };
  }

  if (!isShopifyReadAllowed(config)) {
    return {
      ok: false,
      runId: null,
      productsFetched: 0,
      productsUpserted: 0,
      productsUpdated: 0,
      productsNew: 0,
      productsSkipped: 0,
      productsFailed: 0,
      pagesProcessed: 0,
      completed: false,
      resumed: false,
      durationMs: Date.now() - started,
      errors: [{ message: "Shopify read not allowed." }],
      message: "Full import blocked by read gate."
    };
  }

  const connection = await testShopifyConnection(config);
  console.error(`[full-import] connection ok=${connection.ok} message=${connection.message}`);
  if (!connection.ok) {
    return {
      ok: false,
      runId: null,
      productsFetched: 0,
      productsUpserted: 0,
      productsUpdated: 0,
      productsNew: 0,
      productsSkipped: 0,
      productsFailed: 0,
      pagesProcessed: 0,
      completed: false,
      resumed: false,
      durationMs: Date.now() - started,
      errors: [{ message: connection.message }],
      message: "Shopify connection failed."
    };
  }

  const resumable = await findResumableRun(options.databaseUrl, options.resumeRunId);
  const resumed = Boolean(resumable);
  const run = resumable?.run ?? (await createImportRun({ mode: "full" }, options.databaseUrl));

  const client = new ShopifyReadOnlyClient(config);
  let cursor: string | null = resumable?.cursor ?? null;
  let hasNextPage = true;
  let productsFetched = run.productsFetched ?? 0;
  let productsUpserted = run.productsStaged ?? 0;
  let productsFailed = run.errorsCount ?? 0;
  let pagesProcessed = Number(run.metadata?.pagesProcessed ?? 0);

  if (resumed) {
    console.error(`[full-import] resuming run=${run.id} cursor=${cursor ?? "start"} fetched=${productsFetched}`);
    await updateImportRunProgress(
      run.id,
      { metadata: { ...run.metadata, resumedAt: new Date().toISOString() } },
      options.databaseUrl
    );
  }

  try {
    while (hasNextPage && pagesProcessed < maxPages) {
      let response;
      const fetchAttempts = 3;
      for (let attempt = 1; attempt <= fetchAttempts; attempt += 1) {
        try {
          response = await fetchProductsPage(client, { cursor }, pageSize);
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Fetch failed";
          const throttled = /throttl|429|rate/i.test(message);
          if (attempt === fetchAttempts) throw error;
          const backoff = throttled ? 5000 * attempt : 1500 * attempt;
          console.error(`[full-import] fetch retry ${attempt}/${fetchAttempts} in ${backoff}ms: ${message}`);
          await sleep(backoff);
        }
      }

      if (!response) break;

      const nodes = response.products.edges.map((e) => e.node);
      productsFetched += nodes.length;
      pagesProcessed += 1;

      const batch = await flushBatch(options.databaseUrl, nodes, errors);
      productsUpserted += batch.upserted;
      productsFailed += batch.failed;

      console.error(
        `[full-import] page=${pagesProcessed} batch=${nodes.length} total_fetched=${productsFetched} upserted=${productsUpserted} failed=${productsFailed}`
      );

      hasNextPage = response.products.pageInfo.hasNextPage;
      cursor = response.products.pageInfo.endCursor;

      await updateImportRunProgress(
        run.id,
        {
          productsFetched,
          productsStaged: productsUpserted,
          errorsCount: errors.length,
          cursor,
          metadata: {
            phase: "full_import",
            pagesProcessed,
            connection,
            lastPageSize: nodes.length,
            productsFailed
          }
        },
        options.databaseUrl
      );

      if (nodes.length === 0) break;
      if (hasNextPage && delayMs > 0) await sleep(delayMs);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fetch failed";
    errors.push({ message });
    await finishImportRun(
      run.id,
      {
        status: "failed",
        productsFetched,
        productsStaged: productsUpserted,
        errorsCount: errors.length,
        errorMessage: message,
        cursor,
        metadata: {
          phase: "full_import",
          pagesProcessed,
          connection,
          productsFailed,
          resumable: true
        }
      },
      options.databaseUrl
    );
    return {
      ok: false,
      runId: run.id,
      productsFetched,
      productsUpserted,
      productsUpdated: 0,
      productsNew: 0,
      productsSkipped: 0,
      productsFailed,
      pagesProcessed,
      completed: false,
      resumed,
      durationMs: Date.now() - started,
      errors: errors.slice(0, 100),
      message: `Full import paused (resumable): ${message}`
    };
  }

  await finishImportRun(
    run.id,
    {
      status: "succeeded",
      productsFetched,
      productsStaged: productsUpserted,
      errorsCount: errors.length,
      cursor,
      metadata: {
        phase: "full_import",
        connection,
        pagesProcessed,
        productsFailed,
        durationMs: Date.now() - started,
        completed: true
      }
    },
    options.databaseUrl
  );

  return {
    ok: productsUpserted > 0 || productsFetched === 0,
    runId: run.id,
    productsFetched,
    productsUpserted,
    productsUpdated: 0,
    productsNew: 0,
    productsSkipped: 0,
    productsFailed,
    pagesProcessed,
    completed: true,
    resumed,
    durationMs: Date.now() - started,
    errors: errors.slice(0, 100),
    message: `Full import complete: ${productsUpserted} upserted, ${productsFailed} failed (${productsFetched} fetched, ${pagesProcessed} pages).`
  };
}
