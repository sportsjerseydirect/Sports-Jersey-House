/**
 * Enrich CREATE_NEW_LISTING proposals with evidence summary for admin review.
 */
import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!url) throw new Error("DATABASE_URL required");
  const sql = postgres(url, { max: 1, prepare: false, ssl: "require" });

  try {
    const updated = await sql`
      UPDATE catalogue_proposals cp
      SET
        rationale = coalesce(cp.rationale, '') || E'\n\nEvidence summary:\n' ||
          '- Recommendation: ' || cp.recommendation || E'\n' ||
          '- Status: ' || cp.status || E'\n' ||
          coalesce('- Product link: ' || p.title || ' (' || p.slug || ')', '- New listing (no product yet)') || E'\n' ||
          coalesce('- Sport: ' || p.sport, '- Sport: (infer from proposal)') || E'\n' ||
          coalesce('- League: ' || p.league, '') || E'\n' ||
          coalesce('- Team: ' || p.team, '') || E'\n' ||
          '- Requires human approval before any product is created.',
        updated_at = now()
      FROM products p
      WHERE cp.recommendation = 'CREATE_NEW_LISTING'
        AND cp.status = 'pending_review'
        AND cp.deleted_at IS NULL
        AND (cp.product_id IS NULL OR p.id = cp.product_id)
        AND cp.rationale NOT LIKE '%Evidence summary:%'
    `;

    const rows = await sql`
      SELECT id, title, recommendation, left(rationale, 200) AS rationale_snip
      FROM catalogue_proposals
      WHERE recommendation = 'CREATE_NEW_LISTING' AND status = 'pending_review' AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 15
    `;

    console.log(JSON.stringify({ ok: true, enriched: updated.count, proposals: rows }, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
