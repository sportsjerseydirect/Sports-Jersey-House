import { extractProductsPage } from "./products-extract";

export type ExtractAllProductsOptions = {
  databaseUrl: string;
  maxPages?: number;
  pageSize?: number;
  delayMs?: number;
};

export type ExtractAllProductsResult = {
  runId: string;
  pagesProcessed: number;
  totalFetched: number;
  totalUpserted: number;
  totalErrors: number;
  completed: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function extractAllProducts(
  options: ExtractAllProductsOptions
): Promise<ExtractAllProductsResult> {
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;
  const delayMs = options.delayMs ?? 500;
  let runId = "";
  let pagesProcessed = 0;
  let totalFetched = 0;
  let totalUpserted = 0;
  let totalErrors = 0;
  let hasNextPage = true;

  while (hasNextPage && pagesProcessed < maxPages) {
    const pageOptions: Parameters<typeof extractProductsPage>[0] = {
      databaseUrl: options.databaseUrl
    };

    if (options.pageSize !== undefined) {
      pageOptions.pageSize = options.pageSize;
    }

    if (runId) {
      pageOptions.runId = runId;
    }

    const result = await extractProductsPage(pageOptions);

    runId = result.runId;
    pagesProcessed += 1;
    totalFetched += result.fetched;
    totalUpserted += result.upserted;
    totalErrors += result.errors;
    hasNextPage = result.hasNextPage;

    if (result.checkpoint.completed) {
      break;
    }

    if (hasNextPage && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return {
    runId,
    pagesProcessed,
    totalFetched,
    totalUpserted,
    totalErrors,
    completed: !hasNextPage
  };
}
