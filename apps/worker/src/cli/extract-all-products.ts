import { extractAllProducts } from "@sjh/shopify";

function resolveDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Shopify product extraction.");
  }

  return databaseUrl;
}

async function main(): Promise<void> {
  const options: Parameters<typeof extractAllProducts>[0] = {
    databaseUrl: resolveDatabaseUrl(),
    pageSize: Number(process.env.SHOPIFY_EXTRACT_PAGE_SIZE ?? 100),
    delayMs: Number(process.env.SHOPIFY_EXTRACT_DELAY_MS ?? 500)
  };

  if (process.env.SHOPIFY_EXTRACT_MAX_PAGES) {
    options.maxPages = Number(process.env.SHOPIFY_EXTRACT_MAX_PAGES);
  }

  const result = await extractAllProducts(options);

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Shopify bulk extraction failed.");
  process.exitCode = 1;
});
