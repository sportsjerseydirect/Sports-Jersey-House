/**
 * Autonomous publish for READY Shopify draft products.
 * Batch SQL — no per-product loops. Never publishes NEEDS REVIEW or duplicate suspects.
 */
import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!url) throw new Error("DATABASE_URL required");
  const dryRun = process.argv.includes("--dry-run");

  const sql = postgres(url, { max: 1, prepare: false, ssl: "require", connect_timeout: 30 });

  try {
    const readyIds = await sql<{ id: string; slug: string; title: string }[]>`
      WITH sp AS (
        SELECT p.* FROM products p
        WHERE p.deleted_at IS NULL AND p.shopify_id IS NOT NULL AND p.status = 'draft'
      ),
      img AS (
        SELECT product_id, count(*)::int AS n FROM product_images
        WHERE deleted_at IS NULL GROUP BY product_id
      ),
      var AS (
        SELECT product_id, count(*)::int AS n,
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
        FROM product_catalogue_signals
        GROUP BY product_id
      ),
      enriched AS (
        SELECT sp.id, sp.slug, sp.title,
          (sp.title IS NOT NULL AND trim(sp.title) <> '') AS ok_title,
          (sp.slug IS NOT NULL AND trim(sp.slug) <> '') AS ok_slug,
          coalesce(v.has_price, false) AS ok_price,
          coalesce(v.n, 0) > 0 AS ok_variants,
          coalesce(i.n, 0) > 0 AS ok_images,
          coalesce(s.has_meta, false) AS ok_seo,
          sp.size_chart_id IS NOT NULL AS ok_size_chart,
          sp.customisation_profile_id IS NOT NULL AS ok_customisation,
          sp.option_set_id IS NOT NULL AS ok_option_set,
          (sp.sport IS NOT NULL OR sp.league IS NOT NULL OR sp.team IS NOT NULL) AS ok_taxonomy,
          (sp.description IS NOT NULL AND trim(sp.description) <> ''
            AND sp.description !~* 'imported draft|content pending review') AS ok_description,
          coalesce(d.is_dup, false) AS is_duplicate_suspect
        FROM sp
        LEFT JOIN img i ON i.product_id = sp.id
        LEFT JOIN var v ON v.product_id = sp.id
        LEFT JOIN seo s ON s.product_id = sp.id
        LEFT JOIN dup d ON d.product_id = sp.id
      )
      SELECT id, slug, title
      FROM enriched
      WHERE ok_title AND ok_slug AND ok_price AND ok_variants AND ok_images
        AND ok_seo AND ok_size_chart AND ok_customisation AND ok_option_set AND ok_taxonomy AND ok_description
        AND NOT is_duplicate_suspect
    `;

    if (dryRun) {
      console.log(JSON.stringify({ ok: true, dryRun: true, wouldPublish: readyIds.length, sample: readyIds.slice(0, 5) }, null, 2));
      return;
    }

    if (readyIds.length === 0) {
      console.log(JSON.stringify({ ok: true, published: 0, message: "No READY draft products to publish." }, null, 2));
      return;
    }

    const ids = readyIds.map((row) => row.id);

    const published = await sql`
      UPDATE products
      SET status = 'published', updated_at = now(), updated_by = 'ai-autonomous'
      WHERE id = ANY(${ids}::uuid[])
        AND status = 'draft'
        AND shopify_id IS NOT NULL
        AND deleted_at IS NULL
    `;

    await sql`
      INSERT INTO ai_change_log (category, product_id, field_name, previous_value, new_value, reason, confidence, decision, decided_by, decided_at, applied_at, metadata)
      SELECT
        'taxonomy',
        p.id,
        'status',
        '"draft"'::jsonb,
        '"published"'::jsonb,
        'Autonomous publish: product passed full readiness checklist (READY). Title unchanged.',
        '0.95',
        'auto_applied',
        'ai-autonomous',
        now(),
        now(),
        jsonb_build_object('autonomousPublish', true, 'workflow', 'draft_to_published')
      FROM products p
      WHERE p.id = ANY(${ids}::uuid[]) AND p.status = 'published'
    `;

    const collectionsPublished = await sql`
      UPDATE collections c
      SET status = 'published', updated_at = now(), updated_by = 'ai-autonomous'
      WHERE c.deleted_at IS NULL
        AND c.status <> 'published'
        AND EXISTS (
          SELECT 1 FROM collection_products cp
          INNER JOIN products p ON p.id = cp.product_id
          WHERE cp.collection_id = c.id
            AND p.status = 'published'
            AND p.shopify_id IS NOT NULL
        )
    `;

    const [counts] = await sql`
      SELECT
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'published')::int AS shopify_published,
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'draft')::int AS shopify_draft,
        count(*) FILTER (WHERE status = 'published')::int AS total_published
      FROM products WHERE deleted_at IS NULL
    `;

    console.log(
      JSON.stringify(
        {
          ok: true,
          published: published.count,
          collectionsPublished: collectionsPublished.count,
          counts
        },
        null,
        2
      )
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
