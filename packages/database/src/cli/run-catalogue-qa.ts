/**
 * Full QA pass across Shopify-imported products (batch mode).
 * Computes health scores and applies high-confidence taxonomy/description fixes.
 * Never rewrites product titles.
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  evaluateDescriptionQuality,
  inferTaxonomyFromCatalogueText,
  scoreProductHealth,
  sportFromLeague
} from "@sjh/shared";
import { createDatabaseClient, productImages, productVariants, products, seoRecords } from "../index";
import { collectionProducts } from "../schema-catalogue";
import { aiChangeLog } from "../schema-ops";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const db = createDatabaseClient(databaseUrl);

  const rows = await db
    .select()
    .from(products)
    .where(and(isNull(products.deletedAt), sql`${products.shopifyId} is not null`));

  const productIds = rows.map((row) => row.id);
  if (productIds.length === 0) {
    console.log(JSON.stringify({ ok: true, productsScanned: 0 }, null, 2));
    return;
  }

  const imageCounts = await db
    .select({
      productId: productImages.productId,
      count: sql<number>`count(*)::int`
    })
    .from(productImages)
    .where(and(inArray(productImages.productId, productIds), isNull(productImages.deletedAt)))
    .groupBy(productImages.productId);

  const variantStats = await db
    .select({
      productId: productVariants.productId,
      count: sql<number>`count(*)::int`,
      hasPrice: sql<boolean>`bool_or(price_amount is not null and price_amount::numeric > 0)`
    })
    .from(productVariants)
    .where(and(inArray(productVariants.productId, productIds), isNull(productVariants.deletedAt)))
    .groupBy(productVariants.productId);

  const seoRows = await db
    .select({
      targetId: seoRecords.targetId,
      metaDescription: seoRecords.metaDescription,
      canonicalPath: seoRecords.canonicalPath
    })
    .from(seoRecords)
    .where(and(eq(seoRecords.targetType, "product"), inArray(seoRecords.targetId, productIds)));

  const collectionCounts = await db
    .select({
      productId: collectionProducts.productId,
      count: sql<number>`count(*)::int`
    })
    .from(collectionProducts)
    .where(inArray(collectionProducts.productId, productIds))
    .groupBy(collectionProducts.productId);

  const imageByProduct = new Map(imageCounts.map((row) => [row.productId, row.count]));
  const variantByProduct = new Map(variantStats.map((row) => [row.productId, row]));
  const seoByProduct = new Map(seoRows.map((row) => [row.targetId, row]));
  const collectionByProduct = new Map(collectionCounts.map((row) => [row.productId, row.count]));

  let taxonomyFixed = 0;
  let descriptionsFixed = 0;
  const healthSummary = { healthy: 0, needs_review: 0, at_risk: 0 };
  const recommendations = { KEEP: 0, UPDATE: 0, REVIEW: 0 };

  for (const product of rows) {
    const payload = (product.sourcePayload ?? {}) as Record<string, unknown>;
    const tags = Array.isArray(payload.tags) ? (payload.tags as string[]) : [];
    const sourceCollections = Array.isArray(payload.collections)
      ? (payload.collections as Array<{ title?: string }>).map((c) => c.title ?? "").filter(Boolean)
      : [];

    const inferred = inferTaxonomyFromCatalogueText({
      title: product.title,
      slug: product.slug,
      tags,
      productType: product.productType,
      collections: sourceCollections,
      existing: {
        sport: product.sport,
        league: product.league,
        team: product.team,
        player: product.playerName,
        productType: product.productType
      }
    });

    if (inferred.league && !inferred.sport) {
      inferred.sport = sportFromLeague(inferred.league);
    }

    const patch: Record<string, string> = {};
    if (inferred.sport && inferred.sport !== product.sport) patch.sport = inferred.sport;
    if (inferred.league && inferred.league !== product.league) patch.league = inferred.league;
    if (inferred.team && inferred.team !== product.team) patch.team = inferred.team;
    if (inferred.player && inferred.player !== product.playerName) patch.player = inferred.player;
    if (inferred.productType && inferred.productType !== product.productType) {
      patch.productType = inferred.productType;
    }

    if (Object.keys(patch).length > 0) {
      await db
        .update(products)
        .set({
          ...(patch.sport ? { sport: patch.sport } : {}),
          ...(patch.league ? { league: patch.league } : {}),
          ...(patch.team ? { team: patch.team } : {}),
          ...(patch.player ? { playerName: patch.player } : {}),
          ...(patch.productType ? { productType: patch.productType } : {}),
          updatedAt: new Date(),
          updatedBy: "ai-autonomous"
        })
        .where(eq(products.id, product.id));

      await db.insert(aiChangeLog).values({
        category: "taxonomy",
        productId: product.id,
        fieldName: "taxonomy",
        previousValue: {
          sport: product.sport,
          league: product.league,
          team: product.team,
          player: product.playerName
        },
        newValue: patch,
        reason: "QA pass taxonomy gap fill. Title unchanged.",
        confidence: "0.85",
        decision: "auto_applied",
        decidedBy: "ai-autonomous",
        decidedAt: new Date(),
        appliedAt: new Date(),
        metadata: { qaPass: true }
      });
      taxonomyFixed += 1;
    }

    const sourceHtml = typeof payload.descriptionHtml === "string" ? payload.descriptionHtml : null;
    const descDecision = evaluateDescriptionQuality({
      title: product.title,
      description: product.description,
      sourceHtml
    });

    if (descDecision.action === "improve" && sourceHtml) {
      const cleaned = stripHtml(sourceHtml);
      if (cleaned && cleaned.length >= 40 && cleaned !== product.description) {
        await db
          .update(products)
          .set({ description: cleaned, updatedAt: new Date(), updatedBy: "ai-autonomous" })
          .where(eq(products.id, product.id));
        descriptionsFixed += 1;
      }
    }

    const variant = variantByProduct.get(product.id);
    const seo = seoByProduct.get(product.id);
    const health = scoreProductHealth({
      title: product.title,
      description: product.description,
      sport: patch.sport ?? product.sport,
      league: patch.league ?? product.league,
      team: patch.team ?? product.team,
      player: patch.player ?? product.playerName,
      productType: patch.productType ?? product.productType,
      imageCount: imageByProduct.get(product.id) ?? 0,
      variantCount: variant?.count ?? 0,
      hasPrice: variant?.hasPrice ?? false,
      hasSeoMeta: Boolean(seo?.metaDescription?.trim()),
      hasCanonical: Boolean(seo?.canonicalPath?.trim()),
      collectionCount: collectionByProduct.get(product.id) ?? 0,
      shopifyId: product.shopifyId
    });

    healthSummary[health.status] += 1;
    recommendations[health.recommendation] += 1;
  }

  const [coverage] = await db
    .select({
      withSport: sql<number>`count(*) filter (where sport is not null)::int`,
      withLeague: sql<number>`count(*) filter (where league is not null)::int`,
      withTeam: sql<number>`count(*) filter (where team is not null)::int`,
      withPlayer: sql<number>`count(*) filter (where player_name is not null)::int`,
      total: sql<number>`count(*)::int`
    })
    .from(products)
    .where(and(isNull(products.deletedAt), sql`${products.shopifyId} is not null`));

  console.log(
    JSON.stringify(
      {
        ok: true,
        productsScanned: rows.length,
        taxonomyFixed,
        descriptionsFixed,
        healthSummary,
        recommendations,
        coverage
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
