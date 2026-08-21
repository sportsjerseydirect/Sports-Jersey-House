import { and, eq, isNull, sql } from "drizzle-orm";
import {
  createDatabaseClient,
  productImages,
  productVariants,
  products,
  collectionProducts,
  seoRecords
} from "../index";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const db = createDatabaseClient(databaseUrl);

  const coverage = await db
    .select({
      withSport: sql<number>`count(*) filter (where ${products.sport} is not null)::int`,
      withLeague: sql<number>`count(*) filter (where ${products.league} is not null)::int`,
      withTeam: sql<number>`count(*) filter (where ${products.team} is not null)::int`,
      withPlayer: sql<number>`count(*) filter (where ${products.playerName} is not null)::int`,
      total: sql<number>`count(*)::int`
    })
    .from(products)
    .where(and(isNull(products.deletedAt), sql`${products.shopifyId} is not null`));

  const samples = await db
    .select({
      title: products.title,
      sport: products.sport,
      league: products.league,
      team: products.team,
      player: products.playerName,
      status: products.status
    })
    .from(products)
    .where(and(isNull(products.deletedAt), sql`${products.shopifyId} is not null`))
    .limit(5);

  const slug = "mlb-matthew-boyd-cleveland-guardians-16-jersey";
  const [p] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  if (!p) {
    console.log(JSON.stringify({ coverage: coverage[0], samples, boyd: null }, null, 2));
    return;
  }

  const variants = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.productId, p.id), isNull(productVariants.deletedAt)));
  const images = await db
    .select()
    .from(productImages)
    .where(and(eq(productImages.productId, p.id), isNull(productImages.deletedAt)));
  const memberships = await db
    .select()
    .from(collectionProducts)
    .where(eq(collectionProducts.productId, p.id));
  const [seo] = await db
    .select()
    .from(seoRecords)
    .where(and(eq(seoRecords.targetType, "product"), eq(seoRecords.targetId, p.id)))
    .limit(1);

  console.log(
    JSON.stringify(
      {
        coverage: coverage[0],
        samples,
        boyd: {
          title: p.title,
          status: p.status,
          sport: p.sport,
          league: p.league,
          team: p.team,
          player: p.playerName,
          variants: variants.length,
          images: images.length,
          imageUrl: images[0]?.url ?? null,
          price: variants[0]?.priceAmount ?? null,
          memberships: memberships.length,
          seoMeta: seo?.metaDescription ?? null,
          seoCanonical: seo?.canonicalPath ?? null
        }
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
