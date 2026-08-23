import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

async function main(): Promise<void> {
  const migration = process.argv[2] ?? "0009_supplier_portal.sql";
  const url = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!url) throw new Error("DATABASE_URL required");

  const dir = dirname(fileURLToPath(import.meta.url));
  const sqlText = readFileSync(join(dir, "../../drizzle", migration), "utf8");
  const sql = postgres(url, { max: 1, prepare: false, ssl: "require" });

  try {
    await sql.unsafe(sqlText);
    console.log(JSON.stringify({ ok: true, migration }, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
