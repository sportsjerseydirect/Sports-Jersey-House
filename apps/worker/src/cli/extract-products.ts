import { extractProductsPage } from "@sjh/shopify";

function resolveDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Shopify product extraction.");
  }

  return databaseUrl;
}

async function main(): Promise<void> {
  const result = await extractProductsPage({
    databaseUrl: resolveDatabaseUrl(),
    pageSize: Number(process.env.SHOPIFY_EXTRACT_PAGE_SIZE ?? 100)
  });

  console.log(
    JSON.stringify(
      {
        runId: result.runId,
        fetched: result.fetched,
        upserted: result.upserted,
        errors: result.errors,
        importedCount: result.checkpoint.importedCount,
        completed: result.checkpoint.completed,
        hasNextPage: result.hasNextPage
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Shopify extraction failed.");
  process.exitCode = 1;
});
