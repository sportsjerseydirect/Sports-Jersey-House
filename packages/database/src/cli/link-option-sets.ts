/**
 * Link products to Aris size option sets by sport. Batch SQL only.
 */
import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!url) throw new Error("DATABASE_URL required");
  const sql = postgres(url, { max: 1, prepare: false, ssl: "require", connect_timeout: 30 });

  try {
    const linked = await sql`
      UPDATE products p
      SET
        option_set_id = os.id,
        updated_at = now(),
        updated_by = 'link-option-sets'
      FROM product_option_sets os
      WHERE p.deleted_at IS NULL
        AND p.shopify_id IS NOT NULL
        AND p.option_set_id IS NULL
        AND os.deleted_at IS NULL
        AND (
          (lower(coalesce(p.sport, '')) = 'baseball' AND os.slug = 'baseball-jerseys')
          OR (lower(coalesce(p.sport, '')) = 'hockey' AND os.slug = 'hockey-jerseys')
          OR (lower(coalesce(p.sport, '')) = 'soccer' AND os.slug = 'soccer-jerseys')
          OR (lower(coalesce(p.sport, '')) = 'football' AND os.slug = 'football-jerseys')
          OR (lower(coalesce(p.sport, '')) = 'basketball' AND os.slug = 'basketball-jerseys')
        )`;

    const [coverage] = await sql`
      SELECT
        coalesce(sport, '(null)') AS sport,
        count(*)::int AS total,
        count(*) FILTER (WHERE option_set_id IS NOT NULL)::int AS with_option_set
      FROM products
      WHERE deleted_at IS NULL AND shopify_id IS NOT NULL
      GROUP BY 1
      ORDER BY total DESC`;

    const sets = await sql`
      SELECT slug, sport, jsonb_array_length(sizes) AS sizes
      FROM product_option_sets WHERE deleted_at IS NULL ORDER BY slug`;

    console.log(JSON.stringify({ ok: true, linked: linked.count, coverage, sets }, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
