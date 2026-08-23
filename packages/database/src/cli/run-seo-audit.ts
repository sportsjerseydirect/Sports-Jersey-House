/**
 * Batch SEO audit for published products — read-only report + safe auto-fixes.
 */
import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!url) throw new Error("DATABASE_URL required");
  const fix = process.argv.includes("--fix");

  const sql = postgres(url, { max: 1, prepare: false, ssl: "require", connect_timeout: 20 });

  try {
    const [summary] = await sql`
      WITH pub AS (
        SELECT p.id, p.slug, p.title, p.description, p.sport, p.league
        FROM products p
        WHERE p.deleted_at IS NULL AND p.status = 'published'
      ),
      img AS (
        SELECT product_id,
          count(*)::int AS n,
          count(*) filter (where coalesce(trim(alt_text), '') <> '')::int AS with_alt
        FROM product_images WHERE deleted_at IS NULL GROUP BY product_id
      ),
      seo AS (
        SELECT target_id AS product_id,
          title IS NOT NULL AND trim(title) <> '' AS has_title,
          meta_description IS NOT NULL AND trim(meta_description) <> '' AS has_desc,
          canonical_path IS NOT NULL AND trim(canonical_path) <> '' AS has_canonical
        FROM seo_records WHERE target_type = 'product'
      )
      SELECT
        count(*)::int AS total,
        count(*) filter (where coalesce(trim(pub.description), '') = '')::int AS missing_description,
        count(*) filter (where coalesce(i.n, 0) = 0)::int AS missing_images,
        count(*) filter (where coalesce(i.with_alt, 0) = 0 and coalesce(i.n, 0) > 0)::int AS missing_alt,
        count(*) filter (where not coalesce(s.has_desc, false))::int AS missing_seo_desc,
        count(*) filter (where not coalesce(s.has_canonical, false))::int AS missing_canonical,
        count(*) filter (where pub.sport is null and pub.league is null)::int AS missing_taxonomy
      FROM pub
      LEFT JOIN img i ON i.product_id = pub.id
      LEFT JOIN seo s ON s.product_id = pub.id
    `;

    let altFixed = 0;
    if (fix) {
      const fixed = await sql`
        UPDATE product_images pi
        SET alt_text = p.title, updated_at = now()
        FROM products p
        WHERE pi.product_id = p.id
          AND p.status = 'published'
          AND p.deleted_at IS NULL
          AND pi.deleted_at IS NULL
          AND coalesce(trim(pi.alt_text), '') = ''
          AND pi.url IS NOT NULL
      `;
      altFixed = fixed.count;

      await sql`
        UPDATE seo_records sr
        SET canonical_path = '/products/' || p.slug, updated_at = now()
        FROM products p
        WHERE sr.target_type = 'product'
          AND sr.target_id = p.id
          AND p.status = 'published'
          AND p.deleted_at IS NULL
          AND (sr.canonical_path IS NULL OR trim(sr.canonical_path) = '')
      `;
    }

    console.log(JSON.stringify({ ok: true, fix, summary, altTextFixed: altFixed }, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
