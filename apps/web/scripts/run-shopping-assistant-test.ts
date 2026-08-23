/** Exercise shopping assistant intents against the real product database (no LLM). */
import { runShoppingAssistantTurn } from "@sjh/ai";
import { createDatabaseClient } from "@sjh/database";
import { PostgresSearchProvider } from "@sjh/search";

const QUESTIONS = [
  "Find me a football jersey.",
  "Find Manchester City.",
  "Show me jerseys under £50.",
  "Can I customise this?",
  "What size should I get?",
  "How long does delivery take?",
  "Can I return it?"
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!url) throw new Error("DATABASE_URL required");

  const db = createDatabaseClient(url);
  const search = new PostgresSearchProvider(db);
  const provider = {
    search: (req: Parameters<typeof search.search>[0]) => search.search(req),
    getProductBySlug: (slug: string) => search.getProductBySlug(slug)
  };

  const results = [];
  for (const message of QUESTIONS) {
    const turn = await runShoppingAssistantTurn(message, provider);
    results.push({
      message,
      tool: turn.intent.tool,
      productCount: turn.products.length,
      sampleTitles: turn.products.slice(0, 3).map((p) => p.product.title),
      replyPreview: turn.reply.slice(0, 120)
    });
  }

  const searchOk = results.some((r) => r.productCount > 0);
  const policyOk = results.some((r) => r.tool === "returns_policy" || r.tool === "shipping_info");

  console.log(
    JSON.stringify(
      {
        ok: searchOk && policyOk,
        mode: "rule_based_no_llm",
        results
      },
      null,
      2
    )
  );

  if (!searchOk || !policyOk) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
