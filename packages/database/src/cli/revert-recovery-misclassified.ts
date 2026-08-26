/**
 * Revert the 12 recovery-published products flagged SHOULD BE DRAFTED in audit.
 * Targeted IDs only — does not touch other catalogue rows.
 *
 * Run: tsx --env-file=../../.env src/cli/revert-recovery-misclassified.ts
 * Dry-run: add --dry-run
 */
import postgres from "postgres";

/** Approved audit list — SHOULD BE DRAFTED (2026-08-26) */
export const REVERT_PRODUCT_IDS = [
  "a2e933aa-804f-49e8-96fc-cedb8108dc63", // Maryland Terrapins
  "227fe7f1-8f79-4035-823d-7156ef755e29", // Navy Midshipmen
  "f7f60d3a-d477-493b-8aa8-2050bae9e208", // Washington State Cougars
  "cdbbd0ef-2ccf-4c1a-9ba6-924e3d0001f4", // Milwaukee Bucks novelty
  "cc528795-ca8d-455a-9f4a-fab029cd9017", // Georgetown Hoyas
  "69bab701-3901-4dd2-808e-5bd10f88639c", // Indiana Hoosiers
  "6f55b1ec-8c79-444a-acdf-3fe226e7ff04", // Notre Dame Fighting Irish
  "7ad52b09-6e4b-48a6-8f81-005472f4214a", // Notre Dame Fighting Irish Home
  "0ca8c5b4-4a02-4fe3-8525-14ae403c12ab", // Wisconsin Badgers
  "61f33414-dd18-4bfb-b34b-789cb46dfcbb", // Canada Olympic
  "6c215424-fd5f-4074-8bbd-38a66d11aa26", // Germany Olympic
  "e1449410-dd5d-431f-a57d-cc8400455e88" // Sweden Olympic
] as const;

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!url) throw new Error("DATABASE_URL required");
  const dryRun = process.argv.includes("--dry-run");
  const sql = postgres(url, { max: 1, prepare: false, ssl: "require", connect_timeout: 30 });

  try {
    const before = await sql<
      { id: string; title: string; status: string; sport: string | null }[]
    >`
      SELECT id, title, status, sport
      FROM products
      WHERE id = ANY(${REVERT_PRODUCT_IDS}::uuid[])
        AND deleted_at IS NULL
      ORDER BY title
    `;

    if (before.length !== REVERT_PRODUCT_IDS.length) {
      const found = new Set(before.map((r) => r.id));
      const missing = REVERT_PRODUCT_IDS.filter((id) => !found.has(id));
      throw new Error(`Expected 12 products, found ${before.length}. Missing: ${missing.join(", ")}`);
    }

    const notPublished = before.filter((r) => r.status !== "published");
    if (notPublished.length > 0) {
      console.warn(
        JSON.stringify(
          { warning: "Some targets are not published", rows: notPublished },
          null,
          2
        )
      );
    }

    if (dryRun) {
      console.log(JSON.stringify({ ok: true, dryRun: true, wouldRevert: before.length, products: before }, null, 2));
      return;
    }

    const reverted = await sql`
      UPDATE products
      SET
        status = 'draft',
        sport = NULL,
        league = NULL,
        updated_at = now(),
        updated_by = 'recovery-audit-revert'
      WHERE id = ANY(${REVERT_PRODUCT_IDS}::uuid[])
        AND deleted_at IS NULL
        AND shopify_id IS NOT NULL
    `;

    await sql`
      INSERT INTO ai_change_log (category, product_id, field_name, previous_value, new_value, reason, confidence, decision, decided_by, decided_at, applied_at, metadata)
      SELECT
        'taxonomy',
        p.id,
        'status',
        '"published"'::jsonb,
        '"draft"'::jsonb,
        'Recovery audit revert: misclassified college/international/novelty product returned to draft.',
        '1.0',
        'approved',
        'recovery-audit-revert',
        now(),
        now(),
        jsonb_build_object('recovery81Audit', true, 'group', 'SHOULD_BE_DRAFTED')
      FROM products p
      WHERE p.id = ANY(${REVERT_PRODUCT_IDS}::uuid[]) AND p.status = 'draft'
    `;

    const after = await sql`
      SELECT id, title, status, sport, league
      FROM products
      WHERE id = ANY(${REVERT_PRODUCT_IDS}::uuid[])
      ORDER BY title
    `;

    console.log(
      JSON.stringify(
        {
          ok: true,
          reverted: reverted.count,
          products: after
        },
        null,
        2
      )
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
