import { extractCollectionsPage } from "@sjh/shopify";

function resolveDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Shopify collection extraction.");
  }

  return databaseUrl;
}

async function main(): Promise<void> {
  const result = await extractCollectionsPage({
    databaseUrl: resolveDatabaseUrl(),
    pageSize: Number(process.env.SHOPIFY_EXTRACT_PAGE_SIZE ?? 50)
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Shopify collection extraction failed.");
  process.exitCode = 1;
});
