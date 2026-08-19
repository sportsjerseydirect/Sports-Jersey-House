import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  collectionProducts,
  collections,
  createDatabaseClient,
  products
} from "@sjh/database";
import type { CollectionDetail, CollectionSummary } from "@sjh/shared";
import { collectionDetailSchema, collectionSummarySchema } from "@sjh/shared";
import { loadProductSummaries } from "./get-product";
import type { SearchFacet } from "./index";

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

export async function getCollectionBySlug(
  db: DatabaseClient,
  slug: string
): Promise<CollectionDetail | null> {
  const [collection] = await db
    .select()
    .from(collections)
    .where(
      and(eq(collections.slug, slug), eq(collections.status, "published"), isNull(collections.deletedAt))
    )
    .limit(1);

  if (!collection) {
    return null;
  }

  const productRows = await db
    .select({ product: products })
    .from(collectionProducts)
    .innerJoin(products, eq(collectionProducts.productId, products.id))
    .where(
      and(
        eq(collectionProducts.collectionId, collection.id),
        eq(products.status, "published"),
        isNull(products.deletedAt)
      )
    )
    .orderBy(asc(collectionProducts.sortOrder), asc(products.title));

  const summaries = await loadProductSummaries(
    db,
    productRows.map((row) => row.product)
  );

  return collectionDetailSchema.parse({
    id: collection.id,
    slug: collection.slug,
    title: collection.title,
    description: collection.description ?? undefined,
    status: collection.status,
    products: summaries
  });
}

export async function listPublishedCollectionSlugs(
  db: DatabaseClient,
  limit = 5000
): Promise<string[]> {
  const rows = await db
    .select({ slug: collections.slug })
    .from(collections)
    .where(and(eq(collections.status, "published"), isNull(collections.deletedAt)))
    .orderBy(asc(collections.slug))
    .limit(limit);

  return rows.map((row) => row.slug);
}

export async function listPublishedCollections(
  db: DatabaseClient,
  limit = 5000
): Promise<CollectionSummary[]> {
  const rows = await db
    .select()
    .from(collections)
    .where(and(eq(collections.status, "published"), isNull(collections.deletedAt)))
    .orderBy(asc(collections.title))
    .limit(limit);

  return rows.map((row) =>
    collectionSummarySchema.parse({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description ?? undefined,
      status: row.status
    })
  );
}

export async function getCatalogueFacets(db: DatabaseClient): Promise<SearchFacet[]> {
  const sportRows = await db
    .select({
      value: products.sport,
      count: sql<number>`count(*)::int`
    })
    .from(products)
    .where(and(eq(products.status, "published"), isNull(products.deletedAt)))
    .groupBy(products.sport)
    .orderBy(asc(products.sport));

  const leagueRows = await db
    .select({
      value: products.league,
      count: sql<number>`count(*)::int`
    })
    .from(products)
    .where(and(eq(products.status, "published"), isNull(products.deletedAt)))
    .groupBy(products.league)
    .orderBy(asc(products.league));

  const facets: SearchFacet[] = [];

  for (const row of sportRows) {
    if (!row.value) {
      continue;
    }

    facets.push({ field: "sport", value: row.value, count: row.count });
  }

  for (const row of leagueRows) {
    if (!row.value) {
      continue;
    }

    facets.push({ field: "league", value: row.value, count: row.count });
  }

  return facets;
}

export function createCollectionCatalogue(databaseUrl: string) {
  const db = createDatabaseClient(databaseUrl);

  return {
    getCollectionBySlug: (slug: string) => getCollectionBySlug(db, slug),
    listPublishedCollectionSlugs: (limit?: number) => listPublishedCollectionSlugs(db, limit),
    getCatalogueFacets: () => getCatalogueFacets(db)
  };
}
