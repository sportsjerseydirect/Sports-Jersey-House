/**
 * Refresh SEO meta descriptions that still echo placeholder import copy.
 * Never rewrites product titles.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { buildImageAltText, draftMetaDescription } from "@sjh/shared";
import { createDatabaseClient, products, seoRecords } from "../index";
import { aiChangeLog } from "../schema-ops";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const db = createDatabaseClient(databaseUrl);

  const rows = await db
    .select({
      id: products.id,
      title: products.title,
      slug: products.slug,
      description: products.description,
      team: products.team,
      league: products.league,
      sport: products.sport,
      playerName: products.playerName,
      seoId: seoRecords.id,
      metaDescription: seoRecords.metaDescription
    })
    .from(products)
    .leftJoin(
      seoRecords,
      and(eq(seoRecords.targetType, "product"), eq(seoRecords.targetId, products.id))
    )
    .where(and(isNull(products.deletedAt), sql`${products.shopifyId} is not null`));

  let updated = 0;
  for (const row of rows) {
    const stale =
      !row.metaDescription ||
      /imported draft|content pending review/i.test(row.metaDescription) ||
      /imported draft|content pending review/i.test(row.description ?? "");

    const cleanDescription =
      row.description && !/imported draft|content pending review/i.test(row.description)
        ? row.description
        : null;

    const metaDescription = draftMetaDescription({
      title: row.title,
      description: cleanDescription,
      team: row.team,
      league: row.league,
      sport: row.sport
    });
    const imageAlt = buildImageAltText({
      title: row.title,
      team: row.team,
      player: row.playerName
    });

    if (!stale && row.metaDescription === metaDescription) continue;

    if (row.seoId) {
      await db
        .update(seoRecords)
        .set({
          title: row.title,
          metaDescription,
          canonicalPath: `/products/${row.slug}`,
          updatedAt: new Date(),
          updatedBy: "ai-autonomous"
        })
        .where(eq(seoRecords.id, row.seoId));
    } else {
      await db.insert(seoRecords).values({
        targetType: "product",
        targetId: row.id,
        title: row.title,
        metaDescription,
        canonicalPath: `/products/${row.slug}`,
        approvalStatus: "approved",
        createdBy: "ai-autonomous",
        updatedBy: "ai-autonomous"
      });
    }

    await db
      .update(products)
      .set({
        sourcePayload: sql`coalesce(${products.sourcePayload}, '{}'::jsonb) || ${JSON.stringify({
          suggestedImageAltText: imageAlt
        })}::jsonb`,
        updatedAt: new Date(),
        updatedBy: "ai-autonomous"
      })
      .where(eq(products.id, row.id));

    await db.insert(aiChangeLog).values({
      category: "seo",
      productId: row.id,
      fieldName: "seo_metadata",
      previousValue: { metaDescription: row.metaDescription },
      newValue: {
        title: row.title,
        metaDescription,
        canonicalPath: `/products/${row.slug}`,
        imageAltText: imageAlt
      },
      reason: "Refresh SEO metadata using existing product title (no title rewrite).",
      confidence: "0.88",
      decision: "auto_applied",
      decidedBy: "ai-autonomous",
      decidedAt: new Date(),
      appliedAt: new Date()
    });
    updated += 1;
  }

  console.log(JSON.stringify({ ok: true, updated }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
