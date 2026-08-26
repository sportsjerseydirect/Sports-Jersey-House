/**
 * Unpublish college-intl products that fail current conflict rules.
 */
import postgres from "postgres";
import { classifyCollegeInternationalProduct } from "../college-international-signals";

function pgUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  return url.replace(":6543/", ":5432/");
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const sql = postgres(pgUrl(), { max: 1, prepare: false, ssl: "require", connect_timeout: 60 });

  try {
    const published = await sql<{ id: string; slug: string; title: string; team: string | null }[]>`
      SELECT id, slug, title, team FROM products
      WHERE deleted_at IS NULL AND status = 'published' AND updated_by = 'college-intl-publish'
    `;

    const toRevert = published.filter((p) => {
      const c = classifyCollegeInternationalProduct({ title: p.title, slug: p.slug, team: p.team });
      return c.category === "conflict";
    });

    if (dryRun) {
      console.log(JSON.stringify({ dryRun: true, wouldRevert: toRevert.length, sample: toRevert.slice(0, 10) }, null, 2));
      return;
    }

    if (toRevert.length === 0) {
      console.log(JSON.stringify({ ok: true, reverted: 0 }, null, 2));
      return;
    }

    const ids = toRevert.map((p) => p.id);
    const r = await sql`
      UPDATE products
      SET status = 'draft', sport = NULL, league = NULL,
        updated_at = now(), updated_by = 'college-intl-revert-conflict'
      WHERE id = ANY(${ids}::uuid[]) AND status = 'published'
    `;

    console.log(JSON.stringify({ ok: true, reverted: r.count, slugs: toRevert.map((p) => p.slug).slice(0, 20) }, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
