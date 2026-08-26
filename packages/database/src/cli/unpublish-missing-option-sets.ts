/**
 * Safety: unpublish Shopify products that lack a size option set.
 * Without Aris option sets, PDP cannot offer Size — not customer-ready.
 * Does not invent NFL/NBA sizes. Seeds (shopify_id null) untouched.
 */
import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!url) throw new Error("DATABASE_URL required");
  const dryRun = process.argv.includes("--dry-run");
  const sql = postgres(url, { max: 1, prepare: false, ssl: "require", connect_timeout: 30 });

  try {
    const candidates = await sql<{ id: string; slug: string; sport: string | null }[]>`
      SELECT id, slug, sport
      FROM products
      WHERE deleted_at IS NULL
        AND shopify_id IS NOT NULL
        AND status = 'published'
        AND option_set_id IS NULL
    `;

    if (dryRun) {
      console.log(JSON.stringify({ ok: true, dryRun: true, wouldUnpublish: candidates.length, sample: candidates.slice(0, 5) }, null, 2));
      return;
    }

    if (candidates.length === 0) {
      console.log(JSON.stringify({ ok: true, unpublished: 0 }, null, 2));
      return;
    }

    const ids = candidates.map((c) => c.id);
    const result = await sql`
      UPDATE products
      SET status = 'draft', updated_at = now(), updated_by = 'full-migration-safety'
      WHERE id = ANY(${ids}::uuid[])
        AND status = 'published'
        AND shopify_id IS NOT NULL
        AND option_set_id IS NULL
    `;

    const [after] = await sql`
      SELECT
        count(*) FILTER (WHERE status = 'published' AND shopify_id IS NOT NULL)::int AS pub_shopify,
        count(*) FILTER (WHERE status = 'published' AND shopify_id IS NOT NULL AND option_set_id IS NULL)::int AS pub_no_option_set,
        count(*) FILTER (WHERE status = 'draft' AND shopify_id IS NOT NULL)::int AS draft_shopify
      FROM products WHERE deleted_at IS NULL
    `;

    console.log(JSON.stringify({ ok: true, unpublished: result.count, after, sample: candidates.slice(0, 5) }, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
