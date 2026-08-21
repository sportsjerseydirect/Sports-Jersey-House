import { runControlledSampleImport } from "@sjh/shopify";

function resolveDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for controlled Shopify sample import.");
  }

  return databaseUrl;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main(): Promise<void> {
  const report = await runControlledSampleImport({
    databaseUrl: resolveDatabaseUrl(),
    sampleLimit: parsePositiveInt(process.env.SHOPIFY_SAMPLE_LIMIT, 80),
    pageSize: parsePositiveInt(process.env.SHOPIFY_SAMPLE_PAGE_SIZE, 50)
  });

  console.log(
    JSON.stringify(
      {
        ok: report.ok,
        runId: report.runId,
        sampleLimit: report.sampleLimit,
        connection: report.connection,
        productsFetched: report.productsFetched,
        productsStaged: report.productsStaged,
        productsUpserted: report.productsUpserted,
        productsFailed: report.productsFailed,
        collectionsUpserted: report.collectionsUpserted,
        signalsComputed: report.signalsComputed,
        proposalsCreated: report.proposalsCreated,
        productIdCount: report.productIds.length,
        errorCount: report.errors.length,
        dryRun: report.dryRun,
        message: report.message,
        errors: report.errors.slice(0, 20)
      },
      null,
      2
    )
  );

  if (!report.ok) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Controlled sample import failed.");
  process.exitCode = 1;
});
