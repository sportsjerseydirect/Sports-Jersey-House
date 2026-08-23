/**
 * Batch-enrich Shopify imports: customisation, size charts, made-to-order copy.
 * Single SQL UPDATE — no per-product loops.
 */
import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!url) throw new Error("DATABASE_URL required");

  const sql = postgres(url, { max: 1, prepare: false, ssl: "require", connect_timeout: 15 });

  try {
    const updated = await sql`
      UPDATE products
      SET
        customisation_enabled = true,
        care_instructions = COALESCE(
          care_instructions,
          'Machine wash cold inside out. Hang dry. Do not iron over customisation or prints.'
        ),
        shipping_expectations = COALESCE(
          shipping_expectations,
          'Made to order. Allow approximately 15–35 business days for production and delivery. Tracking is provided after dispatch and may take a few days to activate.'
        ),
        faqs = CASE
          WHEN faqs = '[]'::jsonb OR faqs IS NULL THEN
            '[
              {"question":"Can I customise this jersey?","answer":"Yes. Choose no customisation, name, number, or name + number on the product page."},
              {"question":"What if my size is wrong?","answer":"Items are made to order. We do not operate standard returns for change of mind. Contact support for manufacturing defects, damage, or lost shipments."},
              {"question":"When will I receive tracking?","answer":"Tracking is sent after the order ships. Couriers sometimes take a few days before the number becomes active."}
            ]'::jsonb
          ELSE faqs
        END,
        customisation_profile_id = COALESCE(
          customisation_profile_id,
          (SELECT id FROM customisation_profiles WHERE slug = 'jersey-standard' AND deleted_at IS NULL LIMIT 1)
        ),
        size_chart_id = COALESCE(
          size_chart_id,
          (
            SELECT sc.id
            FROM size_charts sc
            WHERE sc.deleted_at IS NULL
              AND (
                (lower(products.sport) = 'football' AND sc.slug = 'nfl-adult')
                OR (lower(products.sport) = 'basketball' AND sc.slug = 'nba-adult')
                OR (lower(products.sport) = 'hockey' AND sc.slug = 'nhl-adult')
                OR (lower(products.sport) = 'baseball' AND sc.slug = 'mlb-adult')
                OR (lower(products.sport) IN ('soccer', 'football') AND sc.slug = 'soccer-adult')
              )
            LIMIT 1
          )
        ),
        updated_at = now(),
        updated_by = 'ai-autonomous'
      WHERE deleted_at IS NULL AND shopify_id IS NOT NULL
    `;

    const [stats] = await sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE customisation_profile_id IS NOT NULL)::int AS with_customisation,
        count(*) FILTER (WHERE size_chart_id IS NOT NULL)::int AS with_size_chart,
        count(*) FILTER (WHERE shipping_expectations IS NOT NULL)::int AS with_shipping_copy
      FROM products
      WHERE deleted_at IS NULL AND shopify_id IS NOT NULL
    `;

    console.log(JSON.stringify({ ok: true, rowsTouched: updated.count, stats }, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
