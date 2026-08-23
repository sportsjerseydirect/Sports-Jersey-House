import { runControlledFullImport } from "../migration/full-import";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!databaseUrl) throw new Error("DATABASE_URL required");

  if (process.env.ENABLE_SHOPIFY_FULL_IMPORT !== "true") {
    console.error("Set ENABLE_SHOPIFY_FULL_IMPORT=true (ENABLE_SHOPIFY_SYNC must stay false).");
    process.exitCode = 1;
    return;
  }

  if (process.env.ENABLE_SHOPIFY_SYNC === "true") {
    console.error("ABORT: ENABLE_SHOPIFY_SYNC must remain false.");
    process.exitCode = 1;
    return;
  }

  const report = await runControlledFullImport({
    databaseUrl,
    pageSize: Number.parseInt(process.env.SHOPIFY_IMPORT_PAGE_SIZE ?? "50", 10)
  });

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
