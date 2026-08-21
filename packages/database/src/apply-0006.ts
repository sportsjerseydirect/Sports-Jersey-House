import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required.");
  }

  const options: Parameters<typeof postgres>[1] = {
    max: 1,
    prepare: false
  };
  if (/supabase\.co|sslmode=require/i.test(url)) {
    options.ssl = "require";
  }
  const sql = postgres(url, options);

  const migrationPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../drizzle/0006_ops_catalogue_intelligence.sql"
  );
  const migration = readFileSync(migrationPath, "utf8");

  try {
    await sql.unsafe(migration);
    const tables = await sql<{ tablename: string }[]>`
      select tablename
      from pg_tables
      where schemaname = 'public'
        and tablename in (
          'tracking_exceptions',
          'marketing_offers',
          'ops_job_runs',
          'catalogue_proposals',
          'shopify_import_runs',
          'issue_case_evidence'
        )
      order by tablename
    `;
    console.log(
      "0006 applied. Tables:",
      tables.map((row) => row.tablename).join(", ")
    );
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
