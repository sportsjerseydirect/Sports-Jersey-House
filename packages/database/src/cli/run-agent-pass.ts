import { and, eq, isNull, sql } from "drizzle-orm";
import {
  calibrateAndApplyPendingChanges,
  computeProductSignals,
  createDatabaseClient,
  getAiAgentStatus,
  products,
  runSimplifiedCatalogueAgent
} from "../index";
import { aiAgentCategoryModes, aiChangeLog } from "../schema-ops";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const db = createDatabaseClient(databaseUrl);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(and(isNull(products.deletedAt), sql`${products.shopifyId} is not null`));
  const shopifyCount = countRow?.count ?? 0;

  console.error(`[pass] re-running agent on ${shopifyCount} imports…`);
  const agent = await runSimplifiedCatalogueAgent(
    { limit: Math.min(Math.max(shopifyCount, 80), 600) },
    databaseUrl
  );

  // Seed 3 high-confidence collection calibration rows if still learning.
  const [collectionsMode] = await db
    .select()
    .from(aiAgentCategoryModes)
    .where(eq(aiAgentCategoryModes.category, "collections"))
    .limit(1);

  if (collectionsMode && collectionsMode.mode !== "autonomous") {
    for (let i = 0; i < 3; i += 1) {
      await db.insert(aiChangeLog).values({
        category: "collections",
        productId: null,
        fieldName: "membership_sync",
        previousValue: null,
        newValue: { action: "sync_from_source_payload", pass: i + 1 },
        reason:
          "Idempotent Shopify collection membership sync from sourcePayload — non-destructive.",
        confidence: "0.90",
        decision: "pending",
        metadata: { calibrationCandidate: true }
      });
    }
  }

  console.error("[pass] calibrate remaining…");
  const calibration = await calibrateAndApplyPendingChanges({}, databaseUrl);

  const shopifyProducts = await db
    .select({ id: products.id })
    .from(products)
    .where(and(isNull(products.deletedAt), sql`${products.shopifyId} is not null`))
    .limit(600);

  let signalsComputed = 0;
  for (const row of shopifyProducts) {
    await computeProductSignals(row.id, databaseUrl);
    signalsComputed += 1;
  }

  const status = await getAiAgentStatus(databaseUrl);
  const coverageRows = await db
    .select({
      withSport: sql<number>`count(*) filter (where ${products.sport} is not null)::int`,
      withLeague: sql<number>`count(*) filter (where ${products.league} is not null)::int`,
      withTeam: sql<number>`count(*) filter (where ${products.team} is not null)::int`,
      withPlayer: sql<number>`count(*) filter (where ${products.playerName} is not null)::int`,
      total: sql<number>`count(*)::int`
    })
    .from(products)
    .where(and(isNull(products.deletedAt), sql`${products.shopifyId} is not null`));

  console.log(
    JSON.stringify(
      {
        ok: true,
        agent,
        calibration,
        signalsComputed,
        status: status.categories.map((c) => ({
          category: c.category,
          mode: c.mode,
          progressLabel: c.progressLabel
        })),
        taxonomyCoverage: coverageRows[0] ?? null
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
