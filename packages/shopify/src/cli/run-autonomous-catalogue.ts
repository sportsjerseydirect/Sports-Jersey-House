/**
 * Autonomous catalogue pass for imported Shopify products.
 */
import { and, isNull, sql } from "drizzle-orm";
import {
  calibrateAndApplyPendingChanges,
  computeProductSignals,
  createDatabaseClient,
  getAiAgentStatus,
  products,
  runSimplifiedCatalogueAgent
} from "@sjh/database";
import { syncProductCollectionMembershipsFromSourcePayload } from "../load/sync-product-collection-memberships";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");

  console.error("[auto] calibrating + applying high-confidence pending…");
  const calibration = await calibrateAndApplyPendingChanges({}, databaseUrl);
  console.error(
    JSON.stringify({
      totalCalibrated: calibration.totalCalibrated,
      totalAutoApplied: calibration.totalAutoApplied,
      results: calibration.results
    })
  );

  const db = createDatabaseClient(databaseUrl);
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(and(isNull(products.deletedAt), sql`${products.shopifyId} is not null`));
  const shopifyCount = countRow?.count ?? 0;

  console.error(`[auto] running catalogue agent on ${shopifyCount} imports…`);
  const agent = await runSimplifiedCatalogueAgent(
    { limit: Math.min(Math.max(shopifyCount, 80), 600) },
    databaseUrl
  );

  console.error("[auto] calibrating again after new proposals…");
  const calibration2 = await calibrateAndApplyPendingChanges({}, databaseUrl);

  console.error("[auto] syncing collection memberships…");
  const memberships = await syncProductCollectionMembershipsFromSourcePayload(databaseUrl);

  console.error("[auto] computing product signals…");
  const shopifyProducts = await db
    .select({ id: products.id })
    .from(products)
    .where(and(isNull(products.deletedAt), sql`${products.shopifyId} is not null`))
    .limit(600);

  let signalsComputed = 0;
  for (const row of shopifyProducts) {
    await computeProductSignals(row.id, databaseUrl);
    signalsComputed += 1;
    if (signalsComputed % 50 === 0) {
      console.error(`[auto] signals ${signalsComputed}/${shopifyProducts.length}`);
    }
  }

  const status = await getAiAgentStatus(databaseUrl);
  const counts = await db
    .select({
      status: products.status,
      n: sql<number>`count(*)::int`
    })
    .from(products)
    .where(isNull(products.deletedAt))
    .groupBy(products.status);

  console.log(
    JSON.stringify(
      {
        ok: true,
        calibration,
        agent,
        calibration2,
        memberships,
        signalsComputed,
        status: {
          modeLabel: status.modeLabel,
          categories: status.categories.map((c) => ({
            category: c.category,
            mode: c.mode,
            progressLabel: c.progressLabel
          }))
        },
        productCounts: counts
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
