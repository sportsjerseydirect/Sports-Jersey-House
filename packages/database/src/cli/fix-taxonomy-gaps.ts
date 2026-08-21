/**
 * Fill missing sport/league for Shopify imports using established rules.
 * Never touches titles. Logs each change as auto_applied under taxonomy.
 */
import { and, isNull, sql } from "drizzle-orm";
import { inferTaxonomyFromCatalogueText, sportFromLeague } from "@sjh/shared";
import { createDatabaseClient, products } from "../index";
import { aiChangeLog } from "../schema-ops";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const db = createDatabaseClient(databaseUrl);

  const rows = await db
    .select()
    .from(products)
    .where(and(isNull(products.deletedAt), sql`${products.shopifyId} is not null`));

  let updated = 0;
  for (const product of rows) {
    const payload = (product.sourcePayload ?? {}) as Record<string, unknown>;
    const tags = Array.isArray(payload.tags) ? (payload.tags as string[]) : [];
    const inferred = inferTaxonomyFromCatalogueText({
      title: product.title,
      tags,
      productType: product.productType,
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

    // Also try handle / slug tokens
    if (!inferred.league) {
      const fromSlug = inferTaxonomyFromCatalogueText({
        title: `${product.title} ${product.slug}`,
        tags,
        productType: product.productType
      });
      inferred.league = fromSlug.league;
      inferred.sport = fromSlug.sport ?? sportFromLeague(fromSlug.league);
    }

    const patch: Record<string, string> = {};
    const numbered = product.title.replace(/\s+/g, " ").trim().match(/^(.*?)\s+(\d{1,3})\s+Jersey$/i);
    const jerseyHead = numbered?.[1]?.trim() ?? "";
    const canParseJersey = jerseyHead.split(" ").filter(Boolean).length >= 3;

    if (inferred.sport && inferred.sport !== product.sport) patch.sport = inferred.sport;
    if (inferred.league && inferred.league !== product.league) patch.league = inferred.league;
    if (
      inferred.team &&
      (canParseJersey ||
        !product.team ||
        /^\d+\s*Jersey$/i.test(product.team) ||
        /jersey/i.test(product.team) ||
        inferred.team !== product.team)
    ) {
      patch.team = inferred.team;
    }
    if (
      inferred.player &&
      (canParseJersey ||
        !product.playerName ||
        /jersey/i.test(product.playerName) ||
        inferred.player !== product.playerName)
    ) {
      patch.player = inferred.player;
    }
    if (inferred.productType && inferred.productType !== product.productType) {
      patch.productType = inferred.productType;
    }

    if (Object.keys(patch).length === 0) continue;

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
      .where(sql`${products.id} = ${product.id}`);

    await db.insert(aiChangeLog).values({
      category: "taxonomy",
      productId: product.id,
      fieldName: "taxonomy",
      previousValue: {
        sport: product.sport,
        league: product.league,
        team: product.team,
        player: product.playerName,
        productType: product.productType
      },
      newValue: patch,
      reason: "Autonomous taxonomy gap fill from title/tags/slug. Title unchanged.",
      confidence: "0.85",
      decision: "auto_applied",
      decidedBy: "ai-autonomous",
      decidedAt: new Date(),
      appliedAt: new Date(),
      metadata: { gapFill: true }
    });
    updated += 1;
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

  console.log(JSON.stringify({ ok: true, updated, coverage }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
