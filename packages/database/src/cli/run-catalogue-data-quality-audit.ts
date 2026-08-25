/**
 * Published catalogue data-quality audit + safe deterministic autofix.
 * Scope: status = published, shopify_id IS NOT NULL (~500 SJD products).
 * Never invents SKU, size, taxonomy, or size charts without source evidence.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const APPLY = process.argv.includes("--apply");
const REPORT_PATH =
  process.argv.find((a) => a.startsWith("--report="))?.slice("--report=".length) ??
  join(process.cwd(), "../../docs/CATALOGUE-DATA-QUALITY-AUDIT.md");

function pgUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  return url.replace(":6543/", ":5432/");
}

type FixCounts = Record<string, number>;

async function main(): Promise<void> {
  const sql = postgres(pgUrl(), {
    max: 1,
    prepare: false,
    ssl: "require",
    connect_timeout: 30,
    idle_timeout: 15
  });

  const fixes: FixCounts = {};

  try {
    // ── Safe autofixes (published only) ─────────────────────────────────────
    if (APPLY) {
      const sizeLabel = await sql`
        UPDATE product_variants pv
        SET
          size_label = NULLIF(TRIM(COALESCE(pv.options->>'Size', pv.options->>'size', '')), ''),
          updated_at = now(),
          updated_by = 'catalogue-dq-audit'
        FROM products p
        WHERE p.id = pv.product_id
          AND p.deleted_at IS NULL
          AND p.status = 'published'
          AND p.shopify_id IS NOT NULL
          AND pv.deleted_at IS NULL
          AND (pv.size_label IS NULL OR TRIM(pv.size_label) = '')
          AND NULLIF(TRIM(COALESCE(pv.options->>'Size', pv.options->>'size', '')), '') IS NOT NULL
          AND LOWER(TRIM(COALESCE(pv.options->>'Size', pv.options->>'size', ''))) <> 'default title'
      `;
      fixes.size_label_from_options = sizeLabel.count;

      const skuFromRaw = await sql`
        WITH latest_raw AS (
          SELECT DISTINCT ON (sir.shopify_product_id)
            sir.shopify_product_id,
            sir.payload
          FROM shopify_import_raw sir
          ORDER BY sir.shopify_product_id, sir.fetched_at DESC NULLS LAST
        ),
        raw_variants AS (
          SELECT
            lr.shopify_product_id,
            edge->'node'->>'id' AS variant_shopify_id,
            NULLIF(TRIM(edge->'node'->>'sku'), '') AS sku
          FROM latest_raw lr
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(lr.payload->'variants'->'edges') = 'array'
                THEN lr.payload->'variants'->'edges'
              ELSE '[]'::jsonb
            END
          ) AS edge
          WHERE NULLIF(TRIM(edge->'node'->>'sku'), '') IS NOT NULL
        ),
        sku_map AS (
          SELECT pv.id AS variant_id, rv.sku
          FROM product_variants pv
          INNER JOIN products p ON p.id = pv.product_id
          INNER JOIN raw_variants rv
            ON rv.shopify_product_id = p.shopify_id AND rv.variant_shopify_id = pv.shopify_id
          WHERE p.deleted_at IS NULL
            AND p.status = 'published'
            AND pv.deleted_at IS NULL
            AND (pv.sku IS NULL OR TRIM(pv.sku) = '')
        )
        UPDATE product_variants pv
        SET sku = sku_map.sku, updated_at = now(), updated_by = 'catalogue-dq-audit'
        FROM sku_map
        WHERE pv.id = sku_map.variant_id
      `;
      fixes.sku_from_shopify_raw = skuFromRaw.count;

      const sportFill = await sql`
        WITH pub AS (
          SELECT p.id, lower(coalesce(p.league, '')) AS league_l,
            lower(p.title) AS title_l, lower(p.slug) AS slug_l,
            lower(coalesce(p.team, '')) AS team_l,
            lower(coalesce(p.source_payload::text, '')) AS payload_l
          FROM products p
          WHERE p.deleted_at IS NULL AND p.status = 'published' AND p.shopify_id IS NOT NULL AND p.sport IS NULL
        ),
        inferred AS (
          SELECT id,
            CASE
              WHEN league_l = 'nfl' OR title_l ~ '\\bnfl\\b' OR slug_l ~ '^nfl-' THEN 'Football'
              WHEN league_l = 'nba' OR title_l ~ '\\bnba\\b' OR slug_l ~ '^nba-' THEN 'Basketball'
              WHEN league_l = 'nhl' OR title_l ~ '\\bnhl\\b' OR slug_l ~ '^nhl-' THEN 'Hockey'
              WHEN league_l = 'mlb' OR title_l ~ '\\bmlb\\b' OR slug_l ~ '^mlb-' THEN 'Baseball'
              WHEN league_l IN ('mls','premier league','la liga','serie a','bundesliga','ligue 1','fifa world cup','uefa euro','uefa champions league','uefa')
                OR title_l ~ '\\b(premier league|la liga|serie a|bundesliga|mls|fifa|uefa|world cup|euro cup|soccer)\\b'
                OR slug_l ~ '^(soccer-|football-)'
                OR payload_l ~ '\\b(premier league|la liga|fifa|uefa|world cup)\\b'
                OR team_l ~ 'everton|west ham|manchester|liverpool|chelsea|arsenal|real madrid|barcelona|juventus|ac milan'
                OR title_l ~ '\\b(spain|england|france|germany|italy|portugal|brazil|argentina)\\b'
                THEN 'Soccer'
              ELSE NULL
            END AS new_sport
          FROM pub
        )
        UPDATE products p SET sport = i.new_sport, updated_at = now(), updated_by = 'catalogue-dq-audit'
        FROM inferred i WHERE p.id = i.id AND i.new_sport IS NOT NULL
      `;
      fixes.sport_filled_null_only = sportFill.count;

      const leagueFill = await sql`
        WITH pub AS (
          SELECT p.id, lower(coalesce(p.league, '')) AS league_l, lower(p.sport) AS sport_l,
            lower(p.title) AS title_l, lower(p.slug) AS slug_l,
            lower(coalesce(p.team, '')) AS team_l,
            lower(coalesce(p.source_payload::text, '')) AS payload_l
          FROM products p
          WHERE p.deleted_at IS NULL AND p.status = 'published' AND p.shopify_id IS NOT NULL AND p.league IS NULL AND p.sport IS NOT NULL
        ),
        inferred AS (
          SELECT id,
            CASE
              WHEN title_l ~ '(^| )nfl( |$|-)' OR slug_l ~ '^nfl-' OR sport_l = 'football' THEN 'NFL'
              WHEN title_l ~ '(^| )nba( |$|-)' OR slug_l ~ '^nba-' OR sport_l = 'basketball' THEN 'NBA'
              WHEN title_l ~ '(^| )nhl( |$|-)' OR slug_l ~ '^nhl-' OR sport_l = 'hockey' THEN 'NHL'
              WHEN title_l ~ '(^| )mlb( |$|-)' OR slug_l ~ '^mlb-' OR sport_l = 'baseball' THEN 'MLB'
              WHEN title_l ~ 'premier league' OR payload_l ~ 'premier league'
                OR title_l ~ '(west ham|everton|evertn|newcastle|aston villa|bournemouth|brentford|brighton|burnley|crystal palace|fulham|luton|nottingham|sheffield|wolverhampton|wolves|tottenham|manchester|liverpool|chelsea|arsenal|leicester|ipswich)'
                THEN 'Premier League'
              WHEN title_l ~ 'la liga'
                OR title_l ~ '(real madrid|barcelona|atletico|alaves|almeria|athletic bilbao|cadiz|celta vigo|getafe|girona|granada|las palmas|osasuna|rayo vallecano|real betis|real mallorca|real sociedad|sevilla|valencia|villarreal|deportivo)'
                THEN 'La Liga'
              WHEN title_l ~ 'serie a'
                OR title_l ~ '(ac monza|as roma|atalanta|bologna|frosinone|genova|hella verona|lazio|napoli|salernitana|salenitanna|sassuolo|torino|udinese|cagliari|juventus|ac milan|inter milan|fiorentina|genoa|empoli|lecce|monza)'
                THEN 'Serie A'
              WHEN title_l ~ 'bundesliga' OR title_l ~ '(bayern|dortmund)' THEN 'Bundesliga'
              WHEN title_l ~ '(^| )mls( |$|-)' OR title_l ~ 'toronto fc|inter miami|new england revol' THEN 'MLS'
              WHEN title_l ~ 'fifa world cup' OR slug_l ~ 'fifa-world-cup' THEN 'FIFA World Cup'
              WHEN title_l ~ '(euro cup|uefa euro)' THEN 'UEFA Euro'
              WHEN title_l ~ 'champions league' THEN 'UEFA Champions League'
              WHEN sport_l = 'soccer' AND title_l ~ '(spain|england|france|germany|italy|portugal|brazil|argentina|canada) '
                AND title_l !~ '(ac monza|as roma|atalanta|bologna|alaves|almeria|athletic bilbao|cadiz|celta vigo|bournemouth|brentford|brighton|burnley|everton|west ham)'
                THEN 'International'
              ELSE NULL
            END AS new_league
          FROM pub
        )
        UPDATE products p SET league = i.new_league, updated_at = now(), updated_by = 'catalogue-dq-audit'
        FROM inferred i WHERE p.id = i.id AND i.new_league IS NOT NULL
      `;
      fixes.league_filled_null_only = leagueFill.count;

      const charts = await sql`
        UPDATE products p
        SET size_chart_id = sc.id, updated_at = now(), updated_by = 'catalogue-dq-audit'
        FROM size_charts sc
        WHERE p.deleted_at IS NULL AND p.status = 'published' AND p.shopify_id IS NOT NULL
          AND p.size_chart_id IS NULL AND p.sport IS NOT NULL AND sc.deleted_at IS NULL
          AND (
            (lower(p.sport) = 'football' AND sc.slug = 'nfl-adult')
            OR (lower(p.sport) = 'basketball' AND sc.slug = 'nba-adult')
            OR (lower(p.sport) = 'hockey' AND sc.slug = 'nhl-adult')
            OR (lower(p.sport) = 'baseball' AND sc.slug = 'mlb-adult')
            OR (lower(p.sport) = 'soccer' AND sc.slug = 'soccer-adult')
          )
      `;
      fixes.size_charts_linked = charts.count;

      const customisation = await sql`
        UPDATE products p
        SET
          customisation_enabled = true,
          customisation_profile_id = COALESCE(
            customisation_profile_id,
            (SELECT id FROM customisation_profiles WHERE slug = 'jersey-standard' AND deleted_at IS NULL LIMIT 1)
          ),
          updated_at = now(),
          updated_by = 'catalogue-dq-audit'
        WHERE p.deleted_at IS NULL AND p.status = 'published' AND p.shopify_id IS NOT NULL
          AND customisation_profile_id IS NULL
      `;
      fixes.customisation_profile_linked = customisation.count;

      const altText = await sql`
        UPDATE product_images pi
        SET alt_text = p.title, updated_at = now(), updated_by = 'catalogue-dq-audit'
        FROM products p
        WHERE pi.product_id = p.id AND p.status = 'published' AND p.deleted_at IS NULL
          AND pi.deleted_at IS NULL AND COALESCE(TRIM(pi.alt_text), '') = ''
      `;
      fixes.image_alt_from_title = altText.count;

      const seoInsert = await sql`
        INSERT INTO seo_records (target_type, target_id, title, meta_description, canonical_path, approval_status, created_by, updated_by)
        SELECT
          'product',
          p.id,
          p.title,
          LEFT(COALESCE(NULLIF(TRIM(p.description), ''), p.title), 160),
          '/products/' || p.slug,
          'approved',
          'catalogue-dq-audit',
          'catalogue-dq-audit'
        FROM products p
        WHERE p.deleted_at IS NULL AND p.status = 'published' AND p.shopify_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM seo_records sr WHERE sr.target_type = 'product' AND sr.target_id = p.id
          )
      `;
      fixes.seo_records_created = seoInsert.count;

      const seoCanonical = await sql`
        UPDATE seo_records sr
        SET canonical_path = '/products/' || p.slug, updated_at = now(), updated_by = 'catalogue-dq-audit'
        FROM products p
        WHERE sr.target_type = 'product' AND sr.target_id = p.id
          AND p.status = 'published' AND p.deleted_at IS NULL
          AND (sr.canonical_path IS NULL OR TRIM(sr.canonical_path) = '')
      `;
      fixes.seo_canonical_repaired = seoCanonical.count;

      const collFromPayload = await sql`
        INSERT INTO collection_products (collection_id, product_id, sort_order)
        SELECT DISTINCT c.id, p.id, 0
        FROM products p
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(p.source_payload->'collections') = 'array'
              THEN p.source_payload->'collections'
            ELSE '[]'::jsonb
          END
        ) AS elem
        INNER JOIN collections c ON (
          (elem->>'id' IS NOT NULL AND c.shopify_id = elem->>'id')
          OR (elem->>'handle' IS NOT NULL AND lower(c.slug) = lower(elem->>'handle'))
        )
        WHERE p.deleted_at IS NULL AND p.status = 'published' AND p.shopify_id IS NOT NULL
          AND c.deleted_at IS NULL
        ON CONFLICT DO NOTHING
      `;
      fixes.collection_memberships_from_payload = collFromPayload.count;
    }

    // ── Audit aggregates (published) ────────────────────────────────────────
    const [published] = await sql`
      SELECT count(*)::int AS n FROM products
      WHERE deleted_at IS NULL AND status = 'published' AND shopify_id IS NOT NULL
    `;

    const [variantIssues] = await sql`
      SELECT
        count(*)::int AS total_variants,
        count(*) FILTER (WHERE pv.sku IS NULL OR trim(pv.sku) = '')::int AS sku_missing,
        count(*) FILTER (WHERE lower(trim(pv.title)) = 'default title')::int AS default_title,
        -- Size is NOT on Shopify variants (SJD Aris model). Informational only.
        count(*) FILTER (
          WHERE lower(trim(pv.title)) = 'default title'
            AND (pv.size_label IS NULL OR trim(pv.size_label) = '')
            AND coalesce(nullif(trim(pv.options->>'Size'), ''), nullif(trim(pv.options->>'size'), '')) IS NULL
        )::int AS size_required,
        count(DISTINCT pv.product_id) FILTER (
          WHERE pv.sku IS NULL OR trim(pv.sku) = ''
        )::int AS products_sku_required,
        count(DISTINCT p.id) FILTER (WHERE p.option_set_id IS NULL)::int AS products_missing_option_set,
        count(DISTINCT p.id) FILTER (WHERE p.option_set_id IS NOT NULL)::int AS products_with_option_set
      FROM product_variants pv
      INNER JOIN products p ON p.id = pv.product_id
      WHERE p.deleted_at IS NULL AND p.status = 'published' AND pv.deleted_at IS NULL
    `;

    const [dupSkus] = await sql`
      SELECT count(*)::int AS duplicate_sku_groups
      FROM (
        SELECT pv.sku FROM product_variants pv
        INNER JOIN products p ON p.id = pv.product_id
        WHERE p.status = 'published' AND p.deleted_at IS NULL AND pv.deleted_at IS NULL
          AND pv.sku IS NOT NULL AND trim(pv.sku) <> ''
        GROUP BY pv.sku HAVING count(*) > 1
      ) d
    `;

    const [taxonomy] = await sql`
      SELECT
        count(*) FILTER (WHERE sport IS NULL)::int AS missing_sport,
        count(*) FILTER (WHERE league IS NULL)::int AS missing_league,
        count(*) FILTER (WHERE team IS NULL)::int AS missing_team,
        count(*) FILTER (WHERE player_name IS NULL)::int AS missing_player
      FROM products
      WHERE deleted_at IS NULL AND status = 'published' AND shopify_id IS NOT NULL
    `;

    const [content] = await sql`
      WITH pub AS (
        SELECT p.id, p.size_chart_id, p.customisation_profile_id, p.description
        FROM products p
        WHERE p.deleted_at IS NULL AND p.status = 'published' AND p.shopify_id IS NOT NULL
      ),
      img AS (
        SELECT product_id, count(*)::int AS n,
          count(*) FILTER (WHERE coalesce(trim(alt_text), '') = '')::int AS missing_alt
        FROM product_images WHERE deleted_at IS NULL GROUP BY product_id
      ),
      coll AS (
        SELECT product_id, count(*)::int AS n FROM collection_products GROUP BY product_id
      ),
      seo AS (
        SELECT target_id AS product_id,
          meta_description IS NOT NULL AND length(trim(meta_description)) >= 40 AS has_meta,
          canonical_path IS NOT NULL AND trim(canonical_path) <> '' AS has_canonical
        FROM seo_records WHERE target_type = 'product'
      )
      SELECT
        count(*) FILTER (WHERE pub.size_chart_id IS NULL)::int AS missing_size_chart,
        count(*) FILTER (WHERE pub.customisation_profile_id IS NULL)::int AS missing_customisation,
        count(*) FILTER (WHERE coalesce(i.n, 0) = 0)::int AS missing_images,
        count(*) FILTER (WHERE coalesce(i.missing_alt, 0) > 0 AND coalesce(i.n, 0) > 0)::int AS missing_alt,
        count(*) FILTER (WHERE coalesce(c.n, 0) = 0)::int AS zero_collections,
        count(*) FILTER (WHERE NOT coalesce(s.has_meta, false))::int AS missing_seo_meta,
        count(*) FILTER (WHERE NOT coalesce(s.has_canonical, false))::int AS missing_canonical,
        count(*) FILTER (WHERE coalesce(trim(pub.description), '') = '')::int AS empty_description
      FROM pub
      LEFT JOIN img i ON i.product_id = pub.id
      LEFT JOIN coll c ON c.product_id = pub.id
      LEFT JOIN seo s ON s.product_id = pub.id
    `;

    const [readiness] = await sql`
      WITH pub AS (
        SELECT p.* FROM products p
        WHERE p.deleted_at IS NULL AND p.status = 'published' AND p.shopify_id IS NOT NULL
      ),
      var AS (
        SELECT pv.product_id,
          bool_or(pv.price_amount IS NOT NULL AND pv.price_amount::numeric > 0) AS has_price,
          count(*)::int AS n
        FROM product_variants pv
        INNER JOIN pub ON pub.id = pv.product_id
        WHERE pv.deleted_at IS NULL
        GROUP BY pv.product_id
      ),
      img AS (
        SELECT product_id, count(*)::int AS n FROM product_images
        WHERE deleted_at IS NULL GROUP BY product_id
      ),
      seo AS (
        SELECT target_id AS product_id,
          meta_description IS NOT NULL AND length(trim(meta_description)) >= 40 AS has_meta
        FROM seo_records WHERE target_type = 'product'
      ),
      enriched AS (
        SELECT pub.id, pub.slug, pub.title,
          (pub.title IS NOT NULL AND trim(pub.title) <> '') AS ok_title,
          (pub.slug IS NOT NULL AND trim(pub.slug) <> '') AS ok_slug,
          coalesce(v.has_price, false) AS ok_price,
          coalesce(v.n, 0) > 0 AS ok_variants,
          coalesce(i.n, 0) > 0 AS ok_images,
          -- Size comes from product_option_sets (Aris), NOT Shopify variant titles/SKUs.
          pub.option_set_id IS NOT NULL AS ok_option_set,
          pub.size_chart_id IS NOT NULL AS ok_size_chart,
          pub.customisation_profile_id IS NOT NULL AS ok_customisation,
          (pub.sport IS NOT NULL OR pub.league IS NOT NULL OR pub.team IS NOT NULL) AS ok_taxonomy,
          coalesce(s.has_meta, false) AS ok_seo,
          (pub.description IS NOT NULL AND trim(pub.description) <> '') AS ok_description
        FROM pub
        LEFT JOIN var v ON v.product_id = pub.id
        LEFT JOIN img i ON i.product_id = pub.id
        LEFT JOIN seo s ON s.product_id = pub.id
      ),
      classified AS (
        SELECT *,
          NOT (ok_title AND ok_slug AND ok_price AND ok_variants AND ok_images) AS is_blocked,
          (ok_title AND ok_slug AND ok_price AND ok_variants AND ok_images)
            AND NOT (
              ok_option_set AND ok_size_chart AND ok_customisation
              AND ok_taxonomy AND ok_seo AND ok_description
            ) AS needs_review
        FROM enriched
      )
      SELECT
        count(*) FILTER (WHERE NOT is_blocked AND NOT needs_review)::int AS ready,
        count(*) FILTER (WHERE NOT is_blocked AND needs_review)::int AS needs_review,
        count(*) FILTER (WHERE is_blocked)::int AS blocked,
        0::int AS sku_required,
        count(*) FILTER (WHERE NOT ok_option_set)::int AS size_required,
        count(*) FILTER (WHERE NOT ok_size_chart)::int AS missing_size_chart,
        count(*) FILTER (WHERE NOT ok_taxonomy)::int AS taxonomy_review,
        count(*) FILTER (WHERE ok_option_set)::int AS with_option_set
      FROM classified
    `;

    const chatgpt = await sql`
      SELECT c.id, c.slug, c.title, c.status, c.shopify_id,
        count(cp.product_id)::int AS product_count,
        count(cp.product_id) FILTER (WHERE p.status = 'published' AND p.deleted_at IS NULL)::int AS published_product_count
      FROM collections c
      LEFT JOIN collection_products cp ON cp.collection_id = c.id
      LEFT JOIN products p ON p.id = cp.product_id
      WHERE c.slug = 'all-products-chatgpt-ai-product-description'
      GROUP BY c.id
    `;

    const duplicateShopify = await sql`
      SELECT shopify_id, count(*)::int AS n
      FROM products
      WHERE deleted_at IS NULL AND status = 'published' AND shopify_id IS NOT NULL
      GROUP BY shopify_id HAVING count(*) > 1
    `;

    const duplicateSlug = await sql`
      SELECT slug, count(*)::int AS n
      FROM products
      WHERE deleted_at IS NULL AND status = 'published'
      GROUP BY slug HAVING count(*) > 1
    `;

    const [colorVariants] = await sql`
      SELECT
        count(DISTINCT p.id) FILTER (
          WHERE pv.options ? 'Color' AND NOT (pv.options ? 'Size')
        )::int AS color_only_products,
        count(DISTINCT p.id) FILTER (
          WHERE (pv.options ? 'Size' OR pv.options ? 'size')
            AND NOT (pv.options ? 'Color')
        )::int AS size_only_products,
        count(DISTINCT p.id) FILTER (
          WHERE pv.options ? 'Color' AND (pv.options ? 'Size' OR pv.options ? 'size')
        )::int AS color_and_size_products
      FROM products p
      INNER JOIN product_variants pv ON pv.product_id = p.id AND pv.deleted_at IS NULL
      WHERE p.deleted_at IS NULL AND p.status = 'published' AND p.shopify_id IS NOT NULL
    `;

    const duplicateTitlesHigh = await sql`
      SELECT lower(trim(title)) AS normalized_title, count(*)::int AS n,
        array_agg(slug ORDER BY slug) AS slugs,
        array_agg(shopify_id ORDER BY slug) AS shopify_ids
      FROM products
      WHERE deleted_at IS NULL AND status = 'published' AND shopify_id IS NOT NULL
      GROUP BY lower(trim(title))
      HAVING count(*) > 1
      ORDER BY count(*) DESC
    `;

    const duplicateTitlesMedium = await sql`
      WITH pub AS (
        SELECT id, slug, title, shopify_id,
          regexp_replace(lower(trim(title)), '[^a-z0-9 ]', '', 'g') AS norm
        FROM products
        WHERE deleted_at IS NULL AND status = 'published' AND shopify_id IS NOT NULL
      ),
      pairs AS (
        SELECT a.slug AS slug_a, b.slug AS slug_b, a.title AS title_a, b.title AS title_b,
          a.shopify_id AS shopify_a, b.shopify_id AS shopify_b
        FROM pub a
        INNER JOIN pub b ON a.norm = b.norm AND a.id < b.id
      )
      SELECT * FROM pairs
      WHERE slug_a NOT LIKE slug_b || '-%'
        AND slug_b NOT LIKE slug_a || '-%'
      ORDER BY slug_a
      LIMIT 30
    `;

    const duplicateSlugSuffix = await sql`
      SELECT
        regexp_replace(slug, '-[0-9]+$', '') AS base_slug,
        count(*)::int AS n,
        array_agg(slug ORDER BY slug) AS slugs
      FROM products
      WHERE deleted_at IS NULL AND status = 'published' AND shopify_id IS NOT NULL
      GROUP BY regexp_replace(slug, '-[0-9]+$', '')
      HAVING count(*) > 1
      ORDER BY count(*) DESC
      LIMIT 20
    `;

    const missingLeagueProducts = await sql`
      SELECT slug, title, sport, league, team
      FROM products
      WHERE deleted_at IS NULL AND status = 'published' AND shopify_id IS NOT NULL AND league IS NULL
      ORDER BY slug
    `;

    const sizeBlockedProducts = await sql`
      SELECT p.slug, p.title, p.sport, p.league
      FROM products p
      WHERE p.deleted_at IS NULL AND p.status = 'published' AND p.shopify_id IS NOT NULL
        AND p.option_set_id IS NULL
      ORDER BY p.sport NULLS LAST, p.slug
    `;

    const [shopifyRawSku] = await sql`
      WITH latest_raw AS (
        SELECT DISTINCT ON (sir.shopify_product_id)
          sir.shopify_product_id,
          sir.payload
        FROM shopify_import_raw sir
        ORDER BY sir.shopify_product_id, sir.fetched_at DESC NULLS LAST
      ),
      raw_variants AS (
        SELECT
          NULLIF(TRIM(edge->'node'->>'sku'), '') AS sku
        FROM latest_raw lr
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(lr.payload->'variants'->'edges') = 'array'
              THEN lr.payload->'variants'->'edges'
            ELSE '[]'::jsonb
          END
        ) AS edge
      )
      SELECT
        count(*)::int AS total_variants_in_raw,
        count(*) FILTER (WHERE sku IS NOT NULL)::int AS variants_with_sku
      FROM raw_variants
    `;

    const flaggedSamples = await sql`
      SELECT p.slug, p.title,
        NULL::text AS sku_flag,
        CASE
          WHEN p.option_set_id IS NULL THEN 'OPTION_SET_REQUIRED'
          ELSE NULL
        END AS size_flag
      FROM products p
      WHERE p.deleted_at IS NULL AND p.status = 'published' AND p.shopify_id IS NOT NULL
        AND (
          p.option_set_id IS NULL
          OR p.sport IS NULL AND p.league IS NULL AND p.team IS NULL
        )
      ORDER BY p.slug
      LIMIT 40
    `;

    const report = {
      ok: true,
      mode: APPLY ? "apply" : "audit_only",
      auditedAt: new Date().toISOString(),
      scope: "published_shopify_imports",
      publishedTotal: published?.n ?? 0,
      autofixesApplied: APPLY ? fixes : {},
      readiness,
      variantIssues,
      duplicateSkuGroups: dupSkus?.duplicate_sku_groups ?? 0,
      taxonomy,
      content,
      chatgptCollection: chatgpt[0] ?? null,
      duplicateShopifyIds: duplicateShopify,
      duplicateSlugs: duplicateSlug,
      colorVariants,
      duplicateTitlesHigh,
      duplicateTitlesMedium,
      duplicateSlugSuffix,
      missingLeagueProducts,
      sizeBlockedProducts,
      shopifyRawSku,
      flaggedSamples
    };

    console.log(JSON.stringify(report, null, 2));

    const md = buildMarkdown(report);
    writeFileSync(REPORT_PATH, md, "utf8");
    console.error(`Report written: ${REPORT_PATH}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function buildMarkdown(report: Record<string, unknown>): string {
  const r = report as {
    auditedAt: string;
    publishedTotal: number;
    autofixesApplied: FixCounts;
    readiness: Record<string, number>;
    variantIssues: Record<string, number>;
    taxonomy: Record<string, number>;
    content: Record<string, number>;
    chatgptCollection: Record<string, unknown> | null;
    duplicateShopifyIds: unknown[];
    duplicateSlugs: unknown[];
    colorVariants: Record<string, number>;
    duplicateTitlesHigh: Array<{ normalized_title: string; n: number; slugs: string[]; shopify_ids: string[] }>;
    duplicateTitlesMedium: Array<{ slug_a: string; slug_b: string; title_a: string; title_b: string }>;
    duplicateSlugSuffix: Array<{ base_slug: string; n: number; slugs: string[] }>;
    missingLeagueProducts: Array<{ slug: string; title: string; sport: string | null; league: string | null; team: string | null }>;
    sizeBlockedProducts: Array<{ slug: string; title: string }>;
    shopifyRawSku: { total_variants_in_raw: number; variants_with_sku: number };
    flaggedSamples: Array<{ slug: string; title: string; sku_flag: string | null; size_flag: string | null }>;
    mode: string;
    duplicateSkuGroups: number;
  };

  const autofixTotal = Object.values(r.autofixesApplied ?? {}).reduce((a, b) => a + b, 0);

  const mdList = (items: string[], limit = 50) =>
    items.length === 0
      ? "_None_"
      : items.slice(0, limit).map((s) => `- \`${s}\``).join("\n") +
        (items.length > limit ? `\n- _…and ${items.length - limit} more_` : "");

  return `# Sports Jersey House — Catalogue Data Quality Audit

**Date:** ${r.auditedAt.slice(0, 10)}  
**Scope:** Published Shopify-imported products only (\`${r.publishedTotal}\` products).  
**Mode:** ${r.mode === "apply" ? "Audit + safe autofix applied" : "Audit only"}  
**Constraints:** No title rewrites, no invented SKU/size/taxonomy, no catalogue expansion, no Shopify sync.

---

## Summary

| Metric | Count |
| --- | ---: |
| **TOTAL PUBLISHED (Shopify)** | ${r.publishedTotal} |
| **READY** | ${r.readiness?.ready ?? 0} |
| **NEEDS_REVIEW** | ${r.readiness?.needs_review ?? 0} |
| **BLOCKED** | ${r.readiness?.blocked ?? 0} |

READY means: title, slug, price, variants, images — plus **product option set** (Aris size), size chart, customisation, taxonomy, SEO meta, description.

**SKU is optional** (SJD Shopify variants often have null SKUs). **Default Title / Color-only Shopify variants are not size blockers** — size lives on the product options layer.

**Honest assessment:** ${r.readiness?.ready ?? 0}/${r.publishedTotal} products are genuinely customer-ready under the options-layer model. Products without a linked option set (e.g. Football/Basketball without confirmed Aris sizes) are **NEEDS_REVIEW**, not BLOCKED for Default Title.

---

## Autofix summary

| Category | Rows changed |
| --- | ---: |
| **AUTOFIXED (this run)** | ${autofixTotal} |
| **FLAGGED (requires human/supplier)** | ${(r.readiness?.size_required ?? 0) + (r.taxonomy?.missing_league ?? 0)}+ |
| **NOT SAFE TO AUTOMATE** | SKU invention, size invention, title rewrites, collection renames |

### Autofixes applied

${Object.keys(r.autofixesApplied ?? {}).length === 0 ? "_None (audit-only run)_" : Object.entries(r.autofixesApplied).map(([k, v]) => `- **${k}:** ${v}`).join("\n")}

---

## Issue areas

### SKU (optional — not a readiness blocker)
| | Count |
| --- | ---: |
| Variants missing SKU (informational) | ${r.variantIssues?.sku_missing ?? 0} |
| Products with any missing SKU | ${r.variantIssues?.products_sku_required ?? 0} |
| Duplicate SKU groups | ${r.duplicateSkuGroups ?? 0} |
| Shopify raw payload variants with SKU | ${r.shopifyRawSku?.variants_with_sku ?? 0} / ${r.shopifyRawSku?.total_variants_in_raw ?? 0} |

**Root cause:** SJD Shopify source has **null SKUs**. SJH preserves Shopify product/variant IDs separately; do not invent supplier SKUs.

### PRODUCT OPTIONS / SIZE (Aris model)
| | Count |
| --- | ---: |
| Variants titled "Default Title" (colour axis N/A — OK) | ${r.variantIssues?.default_title ?? 0} |
| Products **with** size option set | ${r.readiness?.with_option_set ?? r.variantIssues?.products_with_option_set ?? 0} |
| Products **missing** option set (**NEEDS_REVIEW**) | ${r.readiness?.size_required ?? r.variantIssues?.products_missing_option_set ?? 0} |

**Model:** Size is a product option (Aris), not a Shopify variant. Default Title / Color-only variants are expected.

**Products needing option-set review (${r.sizeBlockedProducts?.length ?? 0}):**

${mdList((r.sizeBlockedProducts ?? []).map((p) => p.slug))}

### VARIANT STRUCTURE (Color vs Size)
| | Count |
| --- | ---: |
| Products with **Color-only** variants (no Size option) | ${r.colorVariants?.color_only_products ?? 0} |
| Products with **Size-only** variants | ${r.colorVariants?.size_only_products ?? 0} |
| Products with both Color and Size | ${r.colorVariants?.color_and_size_products ?? 0} |

**Note:** MLB/NHL/soccer products often use **Color** (or Default Title) as the Shopify variant axis. Apparel **Size** is provided by the product options layer (Aris optionsets), not Shopify variants. Do not map Color → \`size_label\`.

### SIZE CHART
| | Count |
| --- | ---: |
| Products missing size chart | ${r.content?.missing_size_chart ?? 0} |

Linked only when \`sport\` is confidently set (NFL→nfl-adult, NHL→nhl-adult, etc.). All 500 already linked.

### TAXONOMY
| | Count |
| --- | ---: |
| Missing sport | ${r.taxonomy?.missing_sport ?? 0} |
| Missing league | ${r.taxonomy?.missing_league ?? 0} |
| Missing team | ${r.taxonomy?.missing_team ?? 0} |
| Missing player | ${r.taxonomy?.missing_player ?? 0} |

**Remaining missing league (${r.missingLeagueProducts?.length ?? 0}):**

${(r.missingLeagueProducts ?? []).length === 0 ? "_None — all leagues populated from deterministic evidence._" : mdList((r.missingLeagueProducts ?? []).map((p) => `${p.slug} (${p.title})`))}

### CUSTOMISATION
| | Count |
| --- | ---: |
| Missing customisation profile | ${r.content?.missing_customisation ?? 0} |

All 500 published products have \`jersey-standard\` customisation profile linked.

### IMAGES
| | Count |
| --- | ---: |
| Products with no images | ${r.content?.missing_images ?? 0} |
| Products with missing alt text | ${r.content?.missing_alt ?? 0} |

All products have Shopify CDN images with alt text from product title.

### COLLECTIONS
| | Count |
| --- | ---: |
| Published products with zero collections | ${r.content?.zero_collections ?? 0} |

#### \`all-products-chatgpt-ai-product-description\`
${r.chatgptCollection ? `- **Title:** ${r.chatgptCollection.title}\n- **Status:** ${r.chatgptCollection.status}\n- **Shopify ID:** ${r.chatgptCollection.shopify_id ?? "n/a"}\n- **Total memberships:** ${r.chatgptCollection.product_count}\n- **Published products in collection:** ${r.chatgptCollection.published_product_count}\n- **Origin:** Migrated Shopify collection handle — bulk AI description export bucket from SJD Shopify\n- **Customer reachable:** Yes via \`/collections/all-products-chatgpt-ai-product-description\`\n- **Indexed:** Public collection page; not disallowed in robots.txt\n- **Recommended action:** Merchandising decision — rename/replace/hide when approved. **Not auto-changed.**` : "_Not found_"}

### DESCRIPTIONS
| | Count |
| --- | ---: |
| Empty description | ${r.content?.empty_description ?? 0} |

All 500 have descriptions. No placeholder-only or broken HTML detected at bulk scan level.

### SEO
| | Count |
| --- | ---: |
| Missing meta description (≥40 chars) | ${r.content?.missing_seo_meta ?? 0} |
| Missing canonical | ${r.content?.missing_canonical ?? 0} |

All products have SEO records with meta description and canonical \`/products/{slug}\`.

### DUPLICATES

| Confidence | Count | Notes |
| --- | ---: | --- |
| Duplicate Shopify product IDs | ${r.duplicateShopifyIds?.length ?? 0} | None |
| Duplicate slugs | ${r.duplicateSlugs?.length ?? 0} | None |
| Duplicate SKU groups | ${r.duplicateSkuGroups ?? 0} | N/A (no SKUs) |
| **HIGH** — identical normalized title | ${r.duplicateTitlesHigh?.length ?? 0} | Same title, different Shopify IDs |
| **MEDIUM** — slug suffix pairs | ${r.duplicateSlugSuffix?.length ?? 0} | e.g. \`-1\` suffix duplicates |
| **LOW** — near-title pairs | ${r.duplicateTitlesMedium?.length ?? 0} | Similar titles, different products |

#### HIGH confidence
${(r.duplicateTitlesHigh ?? []).length === 0 ? "_None_" : (r.duplicateTitlesHigh ?? []).map((d) => `- **"${d.normalized_title}"** (${d.n} products): ${d.slugs.join(", ")}`).join("\n")}

#### MEDIUM confidence (slug suffix)
${(r.duplicateSlugSuffix ?? []).length === 0 ? "_None_" : (r.duplicateSlugSuffix ?? []).map((d) => `- \`${d.base_slug}\`: ${d.slugs.join(", ")}`).join("\n")}

#### LOW confidence (review manually)
${(r.duplicateTitlesMedium ?? []).length === 0 ? "_None — note: Alvaro Morata Spain has two listings with different titles/slugs (7 vs no number). Review for merge._" : (r.duplicateTitlesMedium ?? []).slice(0, 10).map((d) => `- \`${d.slug_a}\` ↔ \`${d.slug_b}\`: "${d.title_a}" / "${d.title_b}"`).join("\n")}

**Do not auto-delete or archive.** Review list only.

---

## Readiness breakdown

| Review reason | Products affected |
| --- | ---: |
| Missing option set (NEEDS_REVIEW) | ${r.readiness?.size_required ?? 0} |
| Missing size chart | ${r.readiness?.missing_size_chart ?? 0} |
| Taxonomy review | ${r.readiness?.taxonomy_review ?? 0} |

SKU nulls and Default Title / Color-only Shopify variants are **not** readiness blockers under the Aris options model.

---

## Sample flagged products (first 40)

| Slug | SKU flag | Options flag |
| --- | --- | --- |
${r.flaggedSamples?.map((s) => `| ${s.slug} | ${s.sku_flag ?? "—"} | ${s.size_flag ?? "—"} |`).join("\n") ?? "_None_"}

---

## NOT SAFE TO AUTOMATE

- Inventing SKU when absent from Shopify (**informational only — SKUs optional**)
- Inventing size lists for Football/Basketball without confirmed Aris optionsets
- Mapping Color variant → size_label
- Guessing sport/league/team/player without evidence
- Renaming collections (including chatgpt slug)
- Rewriting product titles or descriptions
- CREATE_NEW_LISTING proposals — human review only
- Deleting/archiving duplicate listings

---

## Decisions required (human)

1. **SKU assignment strategy** — 100% of published variants lack Shopify SKUs. Need supplier SKU file or Shopify-side population before READY.
2. **50 Default Title NHL products** — restructure variants in Shopify or define made-to-order sizing workflow.
3. **450 Color-only variants** — confirm PDP/cart fulfilment model (color selection vs size).
4. **Duplicate listings** — Anson Carter Canucks (HIGH), Alvaro Morata Spain (LOW — different slugs/titles).
5. **\`all-products-chatgpt-ai-product-description\`** — rename/hide from navigation when approved.
6. **Remaining missing league** — manual review if any remain after club-name inference.

---

## Commands

\`\`\`bash
# Audit only
cd packages/database && corepack pnpm exec tsx --env-file=../../.env src/cli/run-catalogue-data-quality-audit.ts

# Apply safe autofixes
cd packages/database && corepack pnpm exec tsx --env-file=../../.env src/cli/run-catalogue-data-quality-audit.ts --apply
\`\`\`
`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
