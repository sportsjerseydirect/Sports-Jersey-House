/**
 * Aggregate publish readiness for Shopify imports — single SQL pass.
 */
import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!url) throw new Error("DATABASE_URL required");

  const sql = postgres(url, { max: 1, prepare: false, ssl: "require", connect_timeout: 15 });

  try {
    const [summary] = await sql`
      WITH sp AS (
        SELECT p.*
        FROM products p
        WHERE p.deleted_at IS NULL AND p.shopify_id IS NOT NULL
      ),
      img AS (
        SELECT product_id, count(*)::int AS n
        FROM product_images WHERE deleted_at IS NULL
        GROUP BY product_id
      ),
      var AS (
        SELECT product_id,
          count(*)::int AS n,
          bool_or(price_amount IS NOT NULL AND price_amount::numeric > 0) AS has_price
        FROM product_variants WHERE deleted_at IS NULL
        GROUP BY product_id
      ),
      seo AS (
        SELECT target_id AS product_id,
          meta_description IS NOT NULL AND trim(meta_description) <> '' AS has_meta
        FROM seo_records WHERE target_type = 'product'
      ),
      enriched AS (
        SELECT
          sp.id,
          sp.status,
          (sp.title IS NOT NULL AND trim(sp.title) <> '') AS ok_title,
          (sp.slug IS NOT NULL AND trim(sp.slug) <> '') AS ok_slug,
          coalesce(v.has_price, false) AS ok_price,
          coalesce(v.n, 0) > 0 AS ok_variants,
          coalesce(i.n, 0) > 0 AS ok_images,
          coalesce(s.has_meta, false) AS ok_seo,
          sp.size_chart_id IS NOT NULL AS ok_size_chart,
          sp.customisation_profile_id IS NOT NULL AS ok_customisation,
          (sp.sport IS NOT NULL OR sp.league IS NOT NULL OR sp.team IS NOT NULL) AS ok_taxonomy,
          (sp.description IS NOT NULL AND trim(sp.description) <> '') AS ok_description
        FROM sp
        LEFT JOIN img i ON i.product_id = sp.id
        LEFT JOIN var v ON v.product_id = sp.id
        LEFT JOIN seo s ON s.product_id = sp.id
      ),
      classified AS (
        SELECT *,
          NOT (ok_title AND ok_slug AND ok_price AND ok_variants AND ok_images) AS is_blocked,
          (ok_title AND ok_slug AND ok_price AND ok_variants AND ok_images)
            AND NOT (ok_seo AND ok_size_chart AND ok_customisation AND ok_taxonomy AND ok_description) AS needs_review
        FROM enriched
      )
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status = 'draft')::int AS draft,
        count(*) FILTER (WHERE status = 'published')::int AS published,
        count(*) FILTER (WHERE is_blocked)::int AS blocked,
        count(*) FILTER (WHERE NOT is_blocked AND needs_review)::int AS needs_review,
        count(*) FILTER (WHERE NOT is_blocked AND NOT needs_review)::int AS ready,
        count(*) FILTER (WHERE NOT ok_size_chart)::int AS missing_size_chart,
        count(*) FILTER (WHERE NOT ok_customisation)::int AS missing_customisation,
        count(*) FILTER (WHERE NOT ok_taxonomy)::int AS missing_taxonomy,
        count(*) FILTER (WHERE NOT ok_seo)::int AS missing_seo
      FROM classified
    `;

    console.log(JSON.stringify({ ok: true, readiness: summary }, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
