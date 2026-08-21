/**
 * Restore Matthew Boyd regression product to published + correct taxonomy.
 * Does not publish any other drafts.
 */
import { and, eq, isNull } from "drizzle-orm";
import { inferTaxonomyFromCatalogueText, sportFromLeague } from "@sjh/shared";
import { createDatabaseClient, products } from "../index";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const db = createDatabaseClient(databaseUrl);
  const slug = "mlb-matthew-boyd-cleveland-guardians-16-jersey";

  const [product] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  if (!product) throw new Error("Boyd product missing");

  const payload = (product.sourcePayload ?? {}) as Record<string, unknown>;
  const tags = Array.isArray(payload.tags) ? (payload.tags as string[]) : [];
  const inferred = inferTaxonomyFromCatalogueText({
    title: product.title,
    tags,
    productType: product.productType
  });
  if (inferred.league && !inferred.sport) {
    inferred.sport = sportFromLeague(inferred.league);
  }

  await db
    .update(products)
    .set({
      status: "published",
      sport: inferred.sport ?? "Baseball",
      league: inferred.league ?? "MLB",
      team: inferred.team ?? "Cleveland Guardians",
      playerName: inferred.player ?? "Matthew Boyd",
      updatedAt: new Date(),
      updatedBy: "regression-restore"
    })
    .where(and(eq(products.id, product.id), isNull(products.deletedAt)));

  console.log(
    JSON.stringify(
      {
        ok: true,
        slug,
        restoredStatus: "published",
        sport: inferred.sport ?? "Baseball",
        league: inferred.league ?? "MLB",
        team: inferred.team ?? "Cleveland Guardians",
        player: inferred.player ?? "Matthew Boyd"
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
