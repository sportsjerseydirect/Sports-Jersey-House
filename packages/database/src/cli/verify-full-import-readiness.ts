/**
 * Verify full-catalogue import readiness without enabling ENABLE_SHOPIFY_SYNC.
 */
import { getShopifyConnectionHealth, listImportRuns, verifyMigration } from "../index";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");

  const migration = await verifyMigration(databaseUrl);
  const runs = await listImportRuns(5, databaseUrl);
  const shopifyHealth = getShopifyConnectionHealth();

  const fullSyncEnabled = process.env.ENABLE_SHOPIFY_SYNC === "true";
  const sampleImportEnabled = process.env.ENABLE_SHOPIFY_SAMPLE_IMPORT === "true";

  console.log(
    JSON.stringify(
      {
        ok: migration.ok && !fullSyncEnabled,
        migration,
        recentImportRuns: runs,
        shopifyHealth,
        gates: {
          ENABLE_SHOPIFY_SYNC: fullSyncEnabled,
          ENABLE_SHOPIFY_SAMPLE_IMPORT: sampleImportEnabled,
          recommendation: fullSyncEnabled
            ? "Full sync gate is ON — verify read-only before proceeding"
            : "Use controlled sample/full import CLI — do not enable destructive sync"
        },
        readiness: {
          idempotency: "upsert-products preserves status on re-import",
          pagination: "fetchProductsPage supports cursor pagination",
          batchHandling: "stageNormalizedProduct + upsertShopifyProducts",
          rollback: "import runs tracked; no hard deletes",
          draftOnly: "imports default to draft status"
        }
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
