import { seedDevCatalog, seedDevCollections } from "./index";

function resolveDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to seed development catalogue data.");
  }

  return databaseUrl;
}

async function main(): Promise<void> {
  const databaseUrl = resolveDatabaseUrl();
  const catalogResult = await seedDevCatalog(databaseUrl);

  if (catalogResult.skipped) {
    console.log("Dev catalogue seed skipped — records already present.");
  } else {
    console.log(`Dev catalogue seed complete — inserted ${catalogResult.inserted} products.`);
  }

  const collectionsResult = await seedDevCollections(databaseUrl);

  if (collectionsResult.skipped) {
    console.log("Dev collections seed skipped — records already present.");
    return;
  }

  console.log(`Dev collections seed complete — inserted ${collectionsResult.inserted} collections.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Dev seed failed.");
  process.exitCode = 1;
});
