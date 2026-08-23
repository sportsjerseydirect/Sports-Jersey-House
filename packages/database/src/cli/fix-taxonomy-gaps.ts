/**
 * Batch taxonomy gap fill — chunked updates, batched audit log inserts.
 * Never touches titles.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { inferTaxonomyFromCatalogueText, sportFromLeague } from "@sjh/shared";
import { createDatabaseClient, products } from "../index";
import { aiChangeLog } from "../schema-ops";

const CHUNK = 50;

type PatchRow = {
  id: string;
  patch: Record<string, string>;
  previous: Record<string, string | null>;
};

function buildPatch(product: typeof products.$inferSelect): PatchRow | null {
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

  if (!inferred.league) {
    const fromSlug = inferTaxonomyFromCatalogueText({
      title: `${product.title} ${product.slug}`,
      slug: product.slug,
      tags,
      collections: sourceCollections,
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

  if (Object.keys(patch).length === 0) return null;

  return {
    id: product.id,
    patch,
    previous: {
      sport: product.sport,
      league: product.league,
      team: product.team,
      player: product.playerName,
      productType: product.productType
    }
  };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const db = createDatabaseClient(databaseUrl);

  const rows = await db
    .select()
    .from(products)
    .where(and(isNull(products.deletedAt), sql`${products.shopifyId} is not null`));

  const patches: PatchRow[] = [];
  for (const product of rows) {
    const row = buildPatch(product);
    if (row) patches.push(row);
  }

  let updated = 0;
  const now = new Date();

  for (let i = 0; i < patches.length; i += CHUNK) {
    const chunk = patches.slice(i, i + CHUNK);

    await Promise.all(
      chunk.map((row) =>
        db
          .update(products)
          .set({
            ...(row.patch.sport ? { sport: row.patch.sport } : {}),
            ...(row.patch.league ? { league: row.patch.league } : {}),
            ...(row.patch.team ? { team: row.patch.team } : {}),
            ...(row.patch.player ? { playerName: row.patch.player } : {}),
            ...(row.patch.productType ? { productType: row.patch.productType } : {}),
            updatedAt: now,
            updatedBy: "ai-autonomous"
          })
          .where(eq(products.id, row.id))
      )
    );

    if (chunk.length > 0) {
      await db.insert(aiChangeLog).values(
        chunk.map((row) => ({
          category: "taxonomy" as const,
          productId: row.id,
          fieldName: "taxonomy",
          previousValue: row.previous,
          newValue: row.patch,
          reason: "Batch taxonomy gap fill from title/tags/slug. Title unchanged.",
          confidence: "0.85",
          decision: "auto_applied" as const,
          decidedBy: "ai-autonomous",
          decidedAt: now,
          appliedAt: now,
          metadata: { gapFill: true, batch: true }
        }))
      );
    }

    updated += chunk.length;
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

  console.log(JSON.stringify({ ok: true, updated, candidates: patches.length, coverage }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
