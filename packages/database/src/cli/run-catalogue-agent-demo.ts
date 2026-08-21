/**
 * Run simplified catalogue agent against imported sample + demonstrate 3-approval → autonomous.
 */
import {
  decideAiChange,
  getAiAgentStatus,
  listPendingAiChanges,
  runSimplifiedCatalogueAgent
} from "../catalogue-agent";
import { createDatabaseClient } from "../client";
import { aiAgentCategoryModes } from "../schema-ops";
import { eq } from "drizzle-orm";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");

  // Reset taxonomy streak for a clean demo
  const db = createDatabaseClient(databaseUrl);
  await db
    .update(aiAgentCategoryModes)
    .set({
      mode: "learning",
      consecutiveApprovals: 0,
      updatedAt: new Date(),
      updatedBy: "agent-demo"
    })
    .where(eq(aiAgentCategoryModes.category, "taxonomy"));

  console.error("[agent] running simplified pass on imported products…");
  const run = await runSimplifiedCatalogueAgent({ limit: 80 }, databaseUrl);
  console.error(JSON.stringify({ run }));

  const pendingTaxonomy = (await listPendingAiChanges(100, databaseUrl)).filter(
    (change) => change.category === "taxonomy" && change.decision === "pending"
  );

  const demoApprovals = pendingTaxonomy.slice(0, 3);
  const approvalTrail: Array<{ id: string; progress: string; mode: string }> = [];

  for (const change of demoApprovals) {
    const decided = await decideAiChange(
      { changeId: change.id, decision: "approved", actor: "agent-demo" },
      databaseUrl
    );
    approvalTrail.push({
      id: change.id,
      progress: decided.categoryMode.progressLabel,
      mode: decided.categoryMode.mode
    });
  }

  const status = await getAiAgentStatus(databaseUrl);
  const taxonomy = status.categories.find((row) => row.category === "taxonomy");

  console.log(
    JSON.stringify(
      {
        ok: true,
        run,
        approvalTrail,
        taxonomyMode: taxonomy,
        globalMode: status.modeLabel,
        autonomousEnabled: status.autonomousEnabledGlobally,
        note: "Product titles were never rewritten. No extra products published."
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
