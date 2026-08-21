import {
  calibrateAndApplyPendingChanges,
  getAiAgentStatus
} from "../catalogue-agent";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");

  console.error("[calibrate] applying high-confidence pending changes…");
  const result = await calibrateAndApplyPendingChanges({}, databaseUrl);
  const status = await getAiAgentStatus(databaseUrl);

  console.log(
    JSON.stringify(
      {
        ok: true,
        totalCalibrated: result.totalCalibrated,
        totalAutoApplied: result.totalAutoApplied,
        results: result.results,
        modeLabel: status.modeLabel,
        categories: status.categories.map((c) => ({
          category: c.category,
          mode: c.mode,
          progressLabel: c.progressLabel
        }))
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
