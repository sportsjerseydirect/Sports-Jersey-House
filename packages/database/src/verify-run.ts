import { verifyMigration } from "./verify-migration";

function resolveDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to verify the database migration.");
  }

  return databaseUrl;
}

async function main(): Promise<void> {
  const result = await verifyMigration(resolveDatabaseUrl());

  if (!result.ok) {
    console.error("Migration verification failed.");
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log("Migration verification passed.");
  console.log(
    JSON.stringify(
      {
        extensions: result.extensions,
        tables: result.tables,
        productColumns: result.productColumns,
        devSeedCount: result.devSeedCount
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Migration verification failed.");
  process.exitCode = 1;
});
