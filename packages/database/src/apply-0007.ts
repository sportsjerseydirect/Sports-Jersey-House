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
    "../drizzle/0007_product_approval_workflow.sql"
  );
  const migration = readFileSync(migrationPath, "utf8");

  try {
    await sql.unsafe(migration);
    const enumValues = await sql<{ enumlabel: string }[]>`
      select e.enumlabel
      from pg_type t
      join pg_enum e on t.oid = e.enumtypid
      where t.typname = 'product_status'
      order by e.enumsortorder
    `;
    console.log(
      "0007 applied. product_status values:",
      enumValues.map((row) => row.enumlabel).join(", ")
    );
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
