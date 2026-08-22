import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { createDatabaseClient } from "./client";
import { collectionProducts, products } from "./schema-catalogue";
import { aiChangeLog, catalogueProposals, productCatalogueSignals } from "./schema-ops";
import { getAiAgentStatus } from "./catalogue-agent";

export type CatalogueHealthStats = {
  products: {
    total: number;
    published: number;
    draft: number;
    review: number;
    approved: number;
    archived: number;
    shopifyImported: number;
  };
  taxonomy: {
    withSport: number;
    withLeague: number;
    withTeam: number;
    withPlayer: number;
    missingSport: number;
    missingLeague: number;
    missingTeam: number;
    missingPlayer: number;
    shopifyTotal: number;
  };
  content: {
    missingDescription: number;
    missingImages: number;
    withSeoMeta: number;
    seoIssues: number;
  };
  collections: {
    memberships: number;
  };
  signals: {
    total: number;
    healthy: number;
    needsReview: number;
    atRisk: number;
    duplicateSuspects: number;
    outdated: number;
  };
  proposals: Array<{ recommendation: string; count: number }>;
  aiChanges: Array<{ decision: string; count: number }>;
  pendingHumanDecisions: number;
  agentMode: string;
};

export async function getCatalogueHealthStats(databaseUrl?: string): Promise<CatalogueHealthStats> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const db = createDatabaseClient(url);

  const [statusCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      published: sql<number>`count(*) filter (where ${products.status} = 'published')::int`,
      draft: sql<number>`count(*) filter (where ${products.status} = 'draft')::int`,
      review: sql<number>`count(*) filter (where ${products.status} = 'review')::int`,
      approved: sql<number>`count(*) filter (where ${products.status} = 'approved')::int`,
      archived: sql<number>`count(*) filter (where ${products.status} = 'archived')::int`,
      shopifyImported: sql<number>`count(*) filter (where ${products.shopifyId} is not null)::int`
    })
    .from(products)
    .where(isNull(products.deletedAt));

  const [taxonomy] = await db
    .select({
      withSport: sql<number>`count(*) filter (where sport is not null)::int`,
      withLeague: sql<number>`count(*) filter (where league is not null)::int`,
      withTeam: sql<number>`count(*) filter (where team is not null)::int`,
      withPlayer: sql<number>`count(*) filter (where player_name is not null)::int`,
      shopifyTotal: sql<number>`count(*)::int`
    })
    .from(products)
    .where(and(isNull(products.deletedAt), sql`${products.shopifyId} is not null`));

  const [content] = await db
    .select({
      missingDescription: sql<number>`count(*) filter (where coalesce(trim(${products.description}), '') = '')::int`,
      missingImages: sql<number>`count(*) filter (where not exists (
        select 1 from product_images pi
        where pi.product_id = ${products.id} and pi.deleted_at is null
      ))::int`,
      withSeoMeta: sql<number>`count(*) filter (where exists (
        select 1 from seo_records sr
        where sr.target_type = 'product' and sr.target_id = ${products.id}
          and sr.meta_description is not null and trim(sr.meta_description) <> ''
      ))::int`,
      seoIssues: sql<number>`count(*) filter (where not exists (
        select 1 from seo_records sr
        where sr.target_type = 'product' and sr.target_id = ${products.id}
          and sr.meta_description is not null and trim(sr.meta_description) <> ''
      ))::int`
    })
    .from(products)
    .where(and(isNull(products.deletedAt), sql`${products.shopifyId} is not null`));

  const [memberships] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(collectionProducts);

  const [signals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      healthy: sql<number>`count(*) filter (where health_status = 'healthy')::int`,
      needsReview: sql<number>`count(*) filter (where health_status = 'needs_review')::int`,
      atRisk: sql<number>`count(*) filter (where health_status = 'at_risk')::int`,
      duplicateSuspects: sql<number>`count(*) filter (where is_duplicate_suspect)::int`,
      outdated: sql<number>`count(*) filter (where is_outdated)::int`
    })
    .from(productCatalogueSignals);

  const proposalRows = await db
    .select({
      recommendation: catalogueProposals.recommendation,
      count: sql<number>`count(*)::int`
    })
    .from(catalogueProposals)
    .where(and(isNull(catalogueProposals.deletedAt), eq(catalogueProposals.status, "pending_review")))
    .groupBy(catalogueProposals.recommendation);

  const changeRows = await db
    .select({
      decision: aiChangeLog.decision,
      count: sql<number>`count(*)::int`
    })
    .from(aiChangeLog)
    .groupBy(aiChangeLog.decision);

  const [pendingHuman] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiChangeLog)
    .where(eq(aiChangeLog.decision, "pending"));

  const agentStatus = await getAiAgentStatus(url);

  const tax = taxonomy ?? {
    withSport: 0,
    withLeague: 0,
    withTeam: 0,
    withPlayer: 0,
    shopifyTotal: 0
  };

  return {
    products: {
      total: statusCounts?.total ?? 0,
      published: statusCounts?.published ?? 0,
      draft: statusCounts?.draft ?? 0,
      review: statusCounts?.review ?? 0,
      approved: statusCounts?.approved ?? 0,
      archived: statusCounts?.archived ?? 0,
      shopifyImported: statusCounts?.shopifyImported ?? 0
    },
    taxonomy: {
      withSport: tax.withSport,
      withLeague: tax.withLeague,
      withTeam: tax.withTeam,
      withPlayer: tax.withPlayer,
      missingSport: tax.shopifyTotal - tax.withSport,
      missingLeague: tax.shopifyTotal - tax.withLeague,
      missingTeam: tax.shopifyTotal - tax.withTeam,
      missingPlayer: tax.shopifyTotal - tax.withPlayer,
      shopifyTotal: tax.shopifyTotal
    },
    content: {
      missingDescription: content?.missingDescription ?? 0,
      missingImages: content?.missingImages ?? 0,
      withSeoMeta: content?.withSeoMeta ?? 0,
      seoIssues: content?.seoIssues ?? 0
    },
    collections: { memberships: memberships?.n ?? 0 },
    signals: {
      total: signals?.total ?? 0,
      healthy: signals?.healthy ?? 0,
      needsReview: signals?.needsReview ?? 0,
      atRisk: signals?.atRisk ?? 0,
      duplicateSuspects: signals?.duplicateSuspects ?? 0,
      outdated: signals?.outdated ?? 0
    },
    proposals: proposalRows.map((row) => ({
      recommendation: row.recommendation,
      count: row.count
    })),
    aiChanges: changeRows.map((row) => ({ decision: row.decision, count: row.count })),
    pendingHumanDecisions: pendingHuman?.count ?? 0,
    agentMode: agentStatus.modeLabel
  };
}

export async function listLowHealthProducts(
  limit = 20,
  databaseUrl?: string
): Promise<
  Array<{
    productId: string;
    title: string;
    slug: string;
    healthStatus: string;
    qualityScore: string | null;
  }>
> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const db = createDatabaseClient(url);

  const rows = await db
    .select({
      productId: productCatalogueSignals.productId,
      title: products.title,
      slug: products.slug,
      healthStatus: productCatalogueSignals.healthStatus,
      qualityScore: productCatalogueSignals.qualityScore
    })
    .from(productCatalogueSignals)
    .innerJoin(products, eq(productCatalogueSignals.productId, products.id))
    .where(and(isNull(products.deletedAt), sql`${products.shopifyId} is not null`))
    .orderBy(desc(productCatalogueSignals.computedAt))
    .limit(limit * 3);

  return rows
    .filter((row) => row.healthStatus !== "healthy")
    .slice(0, limit)
    .map((row) => ({
      productId: row.productId ?? "",
      title: row.title,
      slug: row.slug,
      healthStatus: row.healthStatus,
      qualityScore: row.qualityScore
    }));
}
