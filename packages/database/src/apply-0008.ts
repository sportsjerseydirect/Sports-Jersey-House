import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");

  const options: Parameters<typeof postgres>[1] = { max: 1, prepare: false };
  if (/supabase\.co|sslmode=require/i.test(url)) options.ssl = "require";
  const sql = postgres(url, options);

  const migrationPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../drizzle/0008_catalogue_agent_learning.sql"
  );

  try {
    await sql.unsafe(readFileSync(migrationPath, "utf8"));
    const cats = await sql<{ category: string; mode: string }[]>`
      select category, mode from ai_agent_category_modes order by category
    `;
    console.log(
      "0008 applied. Categories:",
      cats.map((row) => `${row.category}=${row.mode}`).join(", ")
    );
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
