/**
 * Audit collection memberships for Shopify imports.
 * Adds high-confidence sport/league collection links when matching SJH collections exist.
 * Does not create new collections.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { createDatabaseClient, products } from "../index";
import { collectionProducts, collections } from "../schema-catalogue";
import { aiChangeLog } from "../schema-ops";

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const db = createDatabaseClient(databaseUrl);

  const allCollections = await db
    .select({ id: collections.id, slug: collections.slug, title: collections.title })
    .from(collections)
    .where(isNull(collections.deletedAt));

  const bySlug = new Map(allCollections.map((c) => [c.slug.toLowerCase(), c]));
  const byTitle = new Map(allCollections.map((c) => [c.title.toLowerCase(), c]));

  function findCollectionForTaxonomy(sport: string | null, league: string | null): typeof allCollections[0] | null {
    if (league) {
      const leagueSlug = normalizeKey(league);
      const hit = bySlug.get(leagueSlug) ?? byTitle.get(league.toLowerCase());
      if (hit) return hit;
    }
    if (sport) {
      const sportSlug = normalizeKey(`${sport}-jerseys`);
      const sportAlt = normalizeKey(sport);
      return bySlug.get(sportSlug) ?? bySlug.get(sportAlt) ?? byTitle.get(`${sport} jerseys`.toLowerCase()) ?? null;
    }
    return null;
  }

  const productRows = await db
    .select({
      id: products.id,
      title: products.title,
      sport: products.sport,
      league: products.league,
      team: products.team
    })
    .from(products)
    .where(and(isNull(products.deletedAt), sql`${products.shopifyId} is not null`));

  let membershipsAdded = 0;
  let alreadyLinked = 0;
  let noMatch = 0;

  for (const product of productRows) {
    const target = findCollectionForTaxonomy(product.sport, product.league);
    if (!target) {
      noMatch += 1;
      continue;
    }

    const [existing] = await db
      .select({ collectionId: collectionProducts.collectionId })
      .from(collectionProducts)
      .where(
        and(eq(collectionProducts.productId, product.id), eq(collectionProducts.collectionId, target.id))
      )
      .limit(1);

    if (existing) {
      alreadyLinked += 1;
      continue;
    }

    await db.insert(collectionProducts).values({
      collectionId: target.id,
      productId: product.id,
      sortOrder: 0
    });

    await db.insert(aiChangeLog).values({
      category: "collections",
      productId: product.id,
      fieldName: "collection_membership",
      previousValue: null,
      newValue: { collectionId: target.id, collectionSlug: target.slug },
      reason: `High-confidence taxonomy collection link (${product.sport ?? ""}/${product.league ?? ""}).`,
      confidence: "0.8",
      decision: "auto_applied",
      decidedBy: "ai-autonomous",
      decidedAt: new Date(),
      appliedAt: new Date(),
      metadata: { auditCollections: true }
    });

    membershipsAdded += 1;
  }

  const [membershipTotal] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(collectionProducts);
  const total = membershipTotal?.n ?? 0;

  console.log(
    JSON.stringify(
      {
        ok: true,
        productsScanned: productRows.length,
        membershipsAdded,
        alreadyLinked,
        noMatch,
        totalMemberships: total
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
