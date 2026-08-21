import {
  computeProductSignals,
  createCatalogueProposal,
  createImportRun,
  finishImportRun,
  stageNormalizedProduct,
  type CatalogueRecommendation
} from "@sjh/database";
import {
  ShopifyReadOnlyClient,
  fetchCollectionsPage,
  fetchProductsPage,
  isShopifyReadAllowed,
  parseShopifyConfig,
  testShopifyConnection,
  type ShopifyConfig,
  type ShopifyProductNode
} from "../index";
import { upsertShopifyCollections } from "../load/upsert-collections";
import { upsertShopifyProducts } from "../load/upsert-products";
import { mapShopifyCollectionToInternal } from "../mappers/shopify-collection-to-internal";
import { mapShopifyProductForSampleImport } from "../mappers/shopify-to-internal";

export type ControlledSampleImportOptions = {
  databaseUrl: string;
  sampleLimit?: number;
  pageSize?: number;
  config?: ShopifyConfig;
  includeCollections?: boolean;
};

export type SampleImportReport = {
  ok: boolean;
  runId: string | null;
  sampleLimit: number;
  connection: {
    ok: boolean;
    shopName?: string;
    domain?: string;
    message: string;
  };
  productsFetched: number;
  productsStaged: number;
  productsUpserted: number;
  productsFailed: number;
  collectionsUpserted: number;
  signalsComputed: number;
  proposalsCreated: number;
  productIds: string[];
  errors: Array<{ shopifyId?: string; stage: string; message: string }>;
  dryRun: boolean;
  message: string;
};

const SAMPLE_LIMIT_CAP = 100;
const DEFAULT_SAMPLE_LIMIT = 80;

function recommendationFromSignal(signal: {
  isOutdated: boolean;
  isDuplicateSuspect: boolean;
  healthStatus: string;
  qualityScore: string | null;
}): CatalogueRecommendation | null {
  if (signal.isDuplicateSuspect) {
    return "DUPLICATE";
  }
  if (signal.isOutdated) {
    return "RETIRE";
  }
  const quality = signal.qualityScore ? Number.parseFloat(signal.qualityScore) : 100;
  if (signal.healthStatus !== "healthy" || quality < 50) {
    return "REVIEW";
  }
  return null;
}

export async function runControlledSampleImport(
  options: ControlledSampleImportOptions
): Promise<SampleImportReport> {
  const sampleLimit = Math.min(
    Math.max(1, options.sampleLimit ?? DEFAULT_SAMPLE_LIMIT),
    SAMPLE_LIMIT_CAP
  );
  const pageSize = Math.min(Math.max(1, options.pageSize ?? 50), sampleLimit);
  const includeCollections = options.includeCollections ?? true;
  const errors: SampleImportReport["errors"] = [];
  const productIds: string[] = [];

  let config: ShopifyConfig;
  try {
    config = options.config ?? parseShopifyConfig(process.env);
  } catch (error) {
    return {
      ok: false,
      runId: null,
      sampleLimit,
      connection: {
        ok: false,
        message: error instanceof Error ? error.message : "Invalid Shopify config."
      },
      productsFetched: 0,
      productsStaged: 0,
      productsUpserted: 0,
      productsFailed: 0,
      collectionsUpserted: 0,
      signalsComputed: 0,
      proposalsCreated: 0,
      productIds: [],
      errors: [
        {
          stage: "config",
          message: error instanceof Error ? error.message : "Invalid Shopify config."
        }
      ],
      dryRun: true,
      message: "Sample import aborted: Shopify config invalid or credentials missing."
    };
  }

  if (!isShopifyReadAllowed(config)) {
    return {
      ok: false,
      runId: null,
      sampleLimit,
      connection: {
        ok: false,
        message:
          "Shopify read access is disabled. Set ENABLE_SHOPIFY_SAMPLE_IMPORT=true for controlled sample imports, or ENABLE_SHOPIFY_SYNC=true only after full migration approval."
      },
      productsFetched: 0,
      productsStaged: 0,
      productsUpserted: 0,
      productsFailed: 0,
      collectionsUpserted: 0,
      signalsComputed: 0,
      proposalsCreated: 0,
      productIds: [],
      errors: [
        {
          stage: "gate",
          message:
            "Neither ENABLE_SHOPIFY_SAMPLE_IMPORT nor ENABLE_SHOPIFY_SYNC is enabled."
        }
      ],
      dryRun: true,
      message: "Sample import blocked by safety gates."
    };
  }

  const connection = await testShopifyConnection(config);
  if (!connection.ok) {
    return {
      ok: false,
      runId: null,
      sampleLimit,
      connection,
      productsFetched: 0,
      productsStaged: 0,
      productsUpserted: 0,
      productsFailed: 0,
      collectionsUpserted: 0,
      signalsComputed: 0,
      proposalsCreated: 0,
      productIds: [],
      errors: [{ stage: "connection", message: connection.message }],
      dryRun: false,
      message: "Sample import aborted: Shopify connection test failed."
    };
  }

  const run = await createImportRun(
    { mode: "sample", sampleLimit },
    options.databaseUrl
  );

  const client = new ShopifyReadOnlyClient(config);
  const collected: ShopifyProductNode[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  try {
    while (collected.length < sampleLimit && hasNextPage) {
      const remaining = sampleLimit - collected.length;
      const first = Math.min(pageSize, remaining);
      const response = await fetchProductsPage(client, { cursor }, first);
      const nodes = response.products.edges.map((edge) => edge.node);
      collected.push(...nodes);
      hasNextPage = response.products.pageInfo.hasNextPage;
      cursor = response.products.pageInfo.endCursor;
      if (nodes.length === 0) {
        break;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Product fetch failed.";
    errors.push({ stage: "fetch", message });
    await finishImportRun(
      run.id,
      {
        status: "failed",
        productsFetched: collected.length,
        productsStaged: 0,
        errorsCount: errors.length,
        errorMessage: message,
        metadata: {
          phase: "sample_import",
          connection,
          sampleLimit
        },
        ...(cursor ? { cursor } : {})
      },
      options.databaseUrl
    );

    return {
      ok: false,
      runId: run.id,
      sampleLimit,
      connection,
      productsFetched: collected.length,
      productsStaged: 0,
      productsUpserted: 0,
      productsFailed: 0,
      collectionsUpserted: 0,
      signalsComputed: 0,
      proposalsCreated: 0,
      productIds: [],
      errors,
      dryRun: run.dryRun,
      message: "Sample import failed during product fetch."
    };
  }

  let productsStaged = 0;
  let productsUpserted = 0;
  let productsFailed = 0;

  for (const node of collected) {
    const draft = mapShopifyProductForSampleImport(node);

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
      productsStaged += 1;
    } catch (error) {
      productsFailed += 1;
      errors.push({
        shopifyId: node.id,
        stage: "stage",
        message: error instanceof Error ? error.message : "Staging failed."
      });
      continue;
    }

    const upsertResult = await upsertShopifyProducts(options.databaseUrl, [draft]);
    if (upsertResult.errors.length > 0) {
      productsFailed += upsertResult.errors.length;
      for (const upsertError of upsertResult.errors) {
        errors.push({
          shopifyId: upsertError.shopifyId,
          stage: "upsert",
          message: upsertError.message
        });
      }
      continue;
    }

    productsUpserted += upsertResult.upserted;
    productIds.push(...upsertResult.productIds);
  }

  let collectionsUpserted = 0;
  if (includeCollections) {
    try {
      const collectionsResponse = await fetchCollectionsPage(client, { cursor: null }, 50);
      const collectionDrafts = collectionsResponse.collections.edges.map((edge) =>
        mapShopifyCollectionToInternal(edge.node)
      );
      const collectionResult = await upsertShopifyCollections(
        options.databaseUrl,
        collectionDrafts
      );
      collectionsUpserted = collectionResult.upserted;
      for (const collectionError of collectionResult.errors) {
        errors.push({
          shopifyId: collectionError.shopifyId,
          stage: "collections",
          message: collectionError.message
        });
      }
    } catch (error) {
      errors.push({
        stage: "collections",
        message: error instanceof Error ? error.message : "Collection import failed."
      });
    }
  }

  let signalsComputed = 0;
  let proposalsCreated = 0;

  for (const productId of productIds) {
    try {
      const signals = await computeProductSignals(productId, options.databaseUrl);
      signalsComputed += signals.length;

      for (const signal of signals) {
        const recommendation = recommendationFromSignal(signal);
        if (!recommendation) {
          continue;
        }

        await createCatalogueProposal(
          {
            recommendation,
            title: `Sample import signal: ${recommendation}`,
            rationale: `Auto-created from controlled sample import signals (${signal.healthStatus}).`,
            productId,
            evidence: Array.isArray(signal.evidence) ? signal.evidence : [signal.evidence],
            proposedChanges: {
              source: "shopify-sample-import",
              signals: signal.signals
            }
          },
          options.databaseUrl
        );
        proposalsCreated += 1;
      }
    } catch (error) {
      errors.push({
        stage: "signals",
        message: error instanceof Error ? error.message : "Signal computation failed.",
        shopifyId: productId
      });
    }
  }

  const finished = await finishImportRun(
    run.id,
    {
      status: errors.some((entry) => entry.stage === "fetch" || entry.stage === "upsert")
        && productsUpserted === 0
        ? "failed"
        : "succeeded",
      productsFetched: collected.length,
      productsStaged,
      errorsCount: errors.length,
      metadata: {
        phase: "sample_import",
        connection,
        sampleLimit,
        productsUpserted,
        productsFailed,
        collectionsUpserted,
        signalsComputed,
        proposalsCreated,
        productIds,
        sampleGatePreferred: config.enableShopifySampleImport,
        syncGateEnabled: config.enableShopifySync
      },
      ...(cursor ? { cursor } : {})
    },
    options.databaseUrl
  );

  const ok = productsUpserted > 0 || (collected.length === 0 && errors.length === 0);

  return {
    ok,
    runId: finished.id,
    sampleLimit,
    connection,
    productsFetched: collected.length,
    productsStaged,
    productsUpserted,
    productsFailed,
    collectionsUpserted,
    signalsComputed,
    proposalsCreated,
    productIds,
    errors,
    dryRun: finished.dryRun,
    message: ok
      ? `Controlled sample import completed: ${productsUpserted} products upserted as draft/review.`
      : "Controlled sample import finished with failures."
  };
}
