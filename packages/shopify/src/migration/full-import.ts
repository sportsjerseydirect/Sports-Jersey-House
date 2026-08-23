/**
 * Read-only full catalogue import — gated by ENABLE_SHOPIFY_FULL_IMPORT=true.
 * ENABLE_SHOPIFY_SYNC must remain false. Products stay draft; no SJD writes.
 */
import {
  createImportRun,
  finishImportRun,
  stageNormalizedProduct
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
  productsSkipped: number;
  productsFailed: number;
  durationMs: number;
  errors: Array<{ shopifyId?: string; message: string }>;
  message: string;
};

export async function runControlledFullImport(options: {
  databaseUrl: string;
  pageSize?: number;
  config?: ShopifyConfig;
}): Promise<FullImportReport> {
  const started = Date.now();
  const pageSize = Math.min(Math.max(options.pageSize ?? 50, 10), 100);
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
      productsSkipped: 0,
      productsFailed: 0,
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
      productsSkipped: 0,
      productsFailed: 0,
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
      productsSkipped: 0,
      productsFailed: 0,
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
      productsSkipped: 0,
      productsFailed: 0,
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
      productsSkipped: 0,
      productsFailed: 0,
      durationMs: Date.now() - started,
      errors: [{ message: connection.message }],
      message: "Shopify connection failed."
    };
  }

  const run = await createImportRun({ mode: "sample", sampleLimit: 99999 }, options.databaseUrl);
  const client = new ShopifyReadOnlyClient(config);
  let cursor: string | null = null;
  let hasNextPage = true;
  let productsFetched = 0;
  let productsUpserted = 0;
  let productsSkipped = 0;
  let productsFailed = 0;
  const batch: ShopifyProductNode[] = [];

  const flushBatch = async (nodes: ShopifyProductNode[]): Promise<void> => {
    if (nodes.length === 0) return;
    const drafts = nodes.map((node) => mapShopifyProductForSampleImport(node));
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      const draft = drafts[i]!;
      try {
        await stageNormalizedProduct(
          run.id,
          {
            shopifyProductId: node.id,
            title: node.title,
            handle: node.handle,
            status: draft.status,
            vendor: node.vendor,
            productType: node.productType,
            payload: node as unknown as Record<string, unknown>,
            normalized: draft as unknown as Record<string, unknown>
          },
          options.databaseUrl
        );
      } catch (error) {
        productsFailed += 1;
        errors.push({
          shopifyId: node.id,
          message: error instanceof Error ? error.message : "Stage failed"
        });
        continue;
      }
    }
    const result = await upsertShopifyProducts(options.databaseUrl, drafts);
    productsUpserted += result.upserted;
    for (const err of result.errors) {
      productsFailed += 1;
      errors.push({ shopifyId: err.shopifyId, message: err.message });
    }
  };

  try {
    while (hasNextPage) {
      const response = await fetchProductsPage(client, { cursor }, pageSize);
      const nodes = response.products.edges.map((e) => e.node);
      productsFetched += nodes.length;
      batch.push(...nodes);

      if (batch.length >= 100) {
        await flushBatch(batch.splice(0, 100));
        console.error(`[full-import] progress fetched=${productsFetched} upserted=${productsUpserted}`);
      }

      hasNextPage = response.products.pageInfo.hasNextPage;
      cursor = response.products.pageInfo.endCursor;
      if (nodes.length === 0) break;
    }

    await flushBatch(batch);
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
        metadata: { phase: "full_import", connection }
      },
      options.databaseUrl
    );
    return {
      ok: false,
      runId: run.id,
      productsFetched,
      productsUpserted,
      productsSkipped,
      productsFailed,
      durationMs: Date.now() - started,
      errors,
      message: "Full import failed during fetch."
    };
  }

  await finishImportRun(
    run.id,
    {
      status: "succeeded",
      productsFetched,
      productsStaged: productsUpserted,
      errorsCount: errors.length,
      metadata: {
        phase: "full_import",
        connection,
        productsUpserted,
        productsSkipped,
        productsFailed,
        durationMs: Date.now() - started
      }
    },
    options.databaseUrl
  );

  return {
    ok: productsUpserted > 0 || productsFetched === 0,
    runId: run.id,
    productsFetched,
    productsUpserted,
    productsSkipped,
    productsFailed,
    durationMs: Date.now() - started,
    errors: errors.slice(0, 50),
    message: `Full import complete: ${productsUpserted} upserted, ${productsSkipped} skipped, ${productsFailed} failed (${productsFetched} fetched).`
  };
}
