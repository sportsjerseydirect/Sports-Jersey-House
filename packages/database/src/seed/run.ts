import { seedDevCatalog } from "./index";

function resolveDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to seed development catalogue data.");
  }

  return databaseUrl;
}

async function main(): Promise<void> {
  const result = await seedDevCatalog(resolveDatabaseUrl());

  if (result.skipped) {
    console.log("Dev catalogue seed skipped — records already present.");
    return;
  }

  console.log(`Dev catalogue seed complete — inserted ${result.inserted} products.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Dev seed failed.");
  process.exitCode = 1;
});
