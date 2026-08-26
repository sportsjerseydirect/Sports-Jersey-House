/**
 * Draft blocker breakdown + sport coverage — batch SQL, no inventions.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

function pgUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  return url.replace(":6543/", ":5432/");
}

async function main(): Promise<void> {
  const sql = postgres(pgUrl(), { max: 1, prepare: false, ssl: "require", connect_timeout: 60 });
  try {
    const [totals] = await sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE shopify_id IS NOT NULL)::int AS shopify,
        count(*) FILTER (WHERE status = 'published')::int AS published,
        count(*) FILTER (WHERE status = 'draft' AND shopify_id IS NOT NULL)::int AS draft_shopify,
        count(*) FILTER (WHERE status = 'published' AND shopify_id IS NULL)::int AS seeds
      FROM products WHERE deleted_at IS NULL`;

    const bySport = await sql`
      SELECT coalesce(sport, '(null)') AS sport, status, count(*)::int AS n
      FROM products
      WHERE deleted_at IS NULL AND shopify_id IS NOT NULL
      GROUP BY 1, 2
      ORDER BY 1, 2`;

    const draftReasons = await sql`
      WITH d AS (
        SELECT p.*
        FROM products p
        WHERE p.deleted_at IS NULL AND p.shopify_id IS NOT NULL AND p.status = 'draft'
      ),
      img AS (
        SELECT product_id, count(*)::int AS n FROM product_images
        WHERE deleted_at IS NULL GROUP BY product_id
      ),
      var AS (
        SELECT product_id,
          count(*)::int AS n,
          bool_or(price_amount IS NOT NULL AND price_amount::numeric > 0) AS has_price
        FROM product_variants WHERE deleted_at IS NULL GROUP BY product_id
      ),
      seo AS (
        SELECT target_id AS product_id,
          meta_description IS NOT NULL AND trim(meta_description) <> '' AS has_meta
        FROM seo_records WHERE target_type = 'product'
      ),
      dup AS (
        SELECT product_id, bool_or(is_duplicate_suspect) AS is_dup
        FROM product_catalogue_signals GROUP BY product_id
      ),
      scored AS (
        SELECT
          d.id,
          coalesce(d.sport, '(null)') AS sport,
          coalesce(d.league, '(null)') AS league,
          (d.sport IS NULL) AS missing_sport,
          (d.league IS NULL) AS missing_league,
          (d.option_set_id IS NULL) AS missing_option_set,
          (d.size_chart_id IS NULL) AS missing_size_chart,
          (d.customisation_profile_id IS NULL) AS missing_customisation,
          coalesce(i.n, 0) = 0 AS missing_image,
          NOT coalesce(v.has_price, false) AS missing_price,
          coalesce(v.n, 0) = 0 AS missing_variants,
          (d.description IS NULL OR trim(d.description) = '' OR d.description ~* 'imported draft|content pending') AS missing_description,
          NOT coalesce(s.has_meta, false) AS missing_seo,
          coalesce(dup.is_dup, false) AS duplicate_suspicion
        FROM d
        LEFT JOIN img i ON i.product_id = d.id
        LEFT JOIN var v ON v.product_id = d.id
        LEFT JOIN seo s ON s.product_id = d.id
        LEFT JOIN dup ON dup.product_id = d.id
      ),
      primary_reason AS (
        SELECT *,
          CASE
            WHEN missing_price OR missing_variants THEN 'missing_price'
            WHEN missing_image THEN 'missing_image'
            WHEN missing_sport THEN 'missing_sport'
            WHEN missing_option_set THEN 'missing_option_set'
            WHEN missing_size_chart THEN 'missing_size_chart'
            WHEN missing_customisation THEN 'missing_customisation'
            WHEN missing_description THEN 'missing_description'
            WHEN missing_seo THEN 'missing_seo'
            WHEN missing_league THEN 'missing_league'
            WHEN duplicate_suspicion THEN 'duplicate_suspicion'
            ELSE 'other_ready_candidate'
          END AS primary_reason
        FROM scored
      )
      SELECT primary_reason, count(*)::int AS n
      FROM primary_reason
      GROUP BY 1
      ORDER BY n DESC`;

    const draftBySportReason = await sql`
      WITH d AS (
        SELECT p.*
        FROM products p
        WHERE p.deleted_at IS NULL AND p.shopify_id IS NOT NULL AND p.status = 'draft'
      ),
      img AS (
        SELECT product_id, count(*)::int AS n FROM product_images
        WHERE deleted_at IS NULL GROUP BY product_id
      ),
      var AS (
        SELECT product_id,
          bool_or(price_amount IS NOT NULL AND price_amount::numeric > 0) AS has_price,
          count(*)::int AS n
        FROM product_variants WHERE deleted_at IS NULL GROUP BY product_id
      ),
      scored AS (
        SELECT
          coalesce(d.sport, '(null)') AS sport,
          CASE
            WHEN NOT coalesce(v.has_price, false) OR coalesce(v.n, 0) = 0 THEN 'missing_price'
            WHEN coalesce(i.n, 0) = 0 THEN 'missing_image'
            WHEN d.sport IS NULL THEN 'missing_sport'
            WHEN d.option_set_id IS NULL THEN 'missing_option_set'
            WHEN d.size_chart_id IS NULL THEN 'missing_size_chart'
            WHEN d.customisation_profile_id IS NULL THEN 'missing_customisation'
            WHEN d.description IS NULL OR trim(d.description) = '' OR d.description ~* 'imported draft|content pending' THEN 'missing_description'
            ELSE 'other_ready_candidate'
          END AS primary_reason
        FROM d
        LEFT JOIN img i ON i.product_id = d.id
        LEFT JOIN var v ON v.product_id = d.id
      )
      SELECT sport, primary_reason, count(*)::int AS n
      FROM scored
      GROUP BY 1, 2
      ORDER BY sport, n DESC`;

    const optionCoverage = await sql`
      SELECT
        coalesce(sport, '(null)') AS sport,
        count(*)::int AS total,
        count(*) FILTER (WHERE option_set_id IS NOT NULL)::int AS with_option_set,
        count(*) FILTER (WHERE status = 'published')::int AS published,
        count(*) FILTER (WHERE status = 'draft')::int AS draft
      FROM products
      WHERE deleted_at IS NULL AND shopify_id IS NOT NULL
      GROUP BY 1
      ORDER BY total DESC`;

    const collections = await sql`
      SELECT c.slug, c.title, c.status, count(cp.product_id)::int AS products
      FROM collections c
      LEFT JOIN collection_products cp ON cp.collection_id = c.id
      WHERE c.deleted_at IS NULL
        AND (c.slug ILIKE '%chatgpt%' OR c.slug ILIKE '%all-products%' OR c.title ILIKE '%chatgpt%')
      GROUP BY c.id
      ORDER BY products DESC`;

    const optionSets = await sql`
      SELECT slug, title, sport, jsonb_array_length(sizes::jsonb) AS size_count
      FROM product_option_sets WHERE deleted_at IS NULL ORDER BY slug`;

    const report = {
      totals,
      draftReasons,
      draftBySportReason,
      bySport,
      optionCoverage,
      optionSets,
      suspiciousCollections: collections
    };

    mkdirSync(join(process.cwd(), "../../docs/full-import-logs"), { recursive: true });
    const out = join(process.cwd(), "../../docs/full-import-logs/DRAFT-BLOCKER-BREAKDOWN.json");
    writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    console.error(`wrote ${out}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
