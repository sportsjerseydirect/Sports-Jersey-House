import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  collectionProducts,
  collections,
  createDatabaseClient,
  products
} from "@sjh/database";
import type { CollectionDetail, CollectionSummary } from "@sjh/shared";
import { collectionDetailSchema, collectionSummarySchema } from "@sjh/shared";
import { LEAGUE_COLLECTION_SLUGS } from "@sjh/shared/src/league-collections";
import { loadProductSummaries } from "./get-product";
import type { SearchFacet } from "./index";

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

/** Cap SSR payload per collection page — full catalogue remains on /products and search. */
const COLLECTION_PAGE_PRODUCT_LIMIT = 500;

async function loadCollectionProductsByLeague(
  db: DatabaseClient,
  league: string
): Promise<Awaited<ReturnType<typeof loadProductSummaries>>> {
  const productRows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.league, league),
        eq(products.status, "published"),
        isNull(products.deletedAt)
      )
    )
    .orderBy(asc(products.title))
    .limit(COLLECTION_PAGE_PRODUCT_LIMIT);

  return loadProductSummaries(db, productRows);
}

async function buildLeagueCollectionDetail(
  db: DatabaseClient,
  slug: string,
  meta: { id: string; title: string; league: string; description?: string }
): Promise<CollectionDetail> {
  const summaries = await loadCollectionProductsByLeague(db, meta.league);

  return collectionDetailSchema.parse({
    id: meta.id,
    slug,
    title: meta.title,
    description: meta.description,
    status: "published",
    products: summaries
  });
}

export async function getCollectionBySlug(
  db: DatabaseClient,
  slug: string
): Promise<CollectionDetail | null> {
  const normalizedSlug = slug.trim().toLowerCase();

  const [collection] = await db
    .select()
    .from(collections)
    .where(
      and(
        eq(collections.slug, normalizedSlug),
        eq(collections.status, "published"),
        isNull(collections.deletedAt)
      )
    )
    .limit(1);

  if (collection) {
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
      .orderBy(asc(collectionProducts.sortOrder), asc(products.title))
      .limit(COLLECTION_PAGE_PRODUCT_LIMIT);

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

  const leagueMeta = LEAGUE_COLLECTION_SLUGS[normalizedSlug];
  if (leagueMeta) {
    return buildLeagueCollectionDetail(db, normalizedSlug, leagueMeta);
  }

  return null;
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

  const slugs = new Set(rows.map((row) => row.slug));
  for (const leagueSlug of Object.keys(LEAGUE_COLLECTION_SLUGS)) {
    slugs.add(leagueSlug);
  }

  return [...slugs].sort((a, b) => a.localeCompare(b));
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
