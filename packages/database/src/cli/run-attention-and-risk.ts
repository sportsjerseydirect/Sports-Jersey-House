import { getOpsAttentionBrief } from "../ops-attention";
import { evaluateOrderRisk, evaluateRecentOrdersRisk } from "../order-risk";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!url) throw new Error("DATABASE_URL required");
  const attention = await getOpsAttentionBrief(url);
  const risk = await evaluateOrderRisk("SJH-10002", url);
  const recent = await evaluateRecentOrdersRisk(20, url);
  console.log(JSON.stringify({ attention: attention.summary, risk, recent }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
