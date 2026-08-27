/**
 * Resolve remaining CONFLICT drafts only — never touches UNKNOWN.
 *
 * Usage:
 *   tsx resolve-catalogue-conflicts.ts --audit-only
 *   tsx resolve-catalogue-conflicts.ts --dry-run
 *   tsx resolve-catalogue-conflicts.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { classifyCollegeInternationalProduct } from "../college-international-signals";
import {
  resolveConflictProduct,
  type ConflictDisposition,
  type ConflictResolution
} from "../conflict-resolution-signals";

const AUDIT_ONLY = process.argv.includes("--audit-only");
const DRY_RUN = process.argv.includes("--dry-run");
const BATCH = 150;

function pgUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  return url.replace(":6543/", ":5432/");
}

type Row = {
  id: string;
  slug: string;
  title: string;
  team: string | null;
  league: string | null;
  sport: string | null;
  product_type: string | null;
  source_payload: { tags?: unknown } | null;
};

function tagsOf(row: Row): string[] {
  const raw = row.source_payload?.tags;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") return raw.split(",").map((t) => t.trim()).filter(Boolean);
  return [];
}

async function main(): Promise<void> {
  const sql = postgres(pgUrl(), { max: 1, prepare: false, ssl: "require", connect_timeout: 120 });
  const startedAt = new Date().toISOString();

  try {
    const [starting] = await sql`
      SELECT
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'published')::int AS shopify_published,
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'draft')::int AS shopify_draft
      FROM products WHERE deleted_at IS NULL`;

    const drafts = await sql<Row[]>`
      SELECT id, slug, title, team, league, sport, product_type, source_payload
      FROM products
      WHERE deleted_at IS NULL AND shopify_id IS NOT NULL AND status = 'draft' AND sport IS NULL
      ORDER BY slug`;

    const conflictRows: { row: Row; resolution: ConflictResolution }[] = [];
    for (const row of drafts) {
      const prior = classifyCollegeInternationalProduct({
        title: row.title,
        slug: row.slug,
        team: row.team,
        league: row.league,
        sourcePayload: JSON.stringify(row.source_payload ?? {})
      });
      if (prior.category !== "conflict") continue;
      const resolution = resolveConflictProduct({
        title: row.title,
        slug: row.slug,
        team: row.team,
        tags: tagsOf(row),
        productType: row.product_type
      });
      conflictRows.push({ row, resolution });
    }

    const counts: Record<ConflictDisposition, number> = {
      SAFE_TO_FIX: 0,
      HUMAN_REVIEW: 0,
      INVALID_PRODUCT: 0
    };
    const examples: Record<ConflictDisposition, { slug: string; title: string; reason: string }[]> = {
      SAFE_TO_FIX: [],
      HUMAN_REVIEW: [],
      INVALID_PRODUCT: []
    };

    for (const { row, resolution } of conflictRows) {
      counts[resolution.disposition]++;
      if (examples[resolution.disposition].length < 8) {
        examples[resolution.disposition].push({
          slug: row.slug,
          title: row.title,
          reason: resolution.reason
        });
      }
    }

    console.log(JSON.stringify({ phase: "audit", conflicts: conflictRows.length, counts, examples }, null, 2));

    if (AUDIT_ONLY) {
      writeReport({
        startedAt,
        completedAt: new Date().toISOString(),
        auditOnly: true,
        starting,
        conflictsReviewed: conflictRows.length,
        counts,
        examples,
        products: conflictRows.map(({ row, resolution }) => ({
          id: row.id,
          slug: row.slug,
          title: row.title,
          disposition: resolution.disposition,
          sport: resolution.sport,
          league: resolution.league,
          reason: resolution.reason,
          evidence: resolution.evidence,
          action: "none"
        }))
      });
      return;
    }

    const safe = conflictRows.filter((c) => c.resolution.disposition === "SAFE_TO_FIX" && c.resolution.sport);
    let classified = 0;
    let leaguesSet = 0;
    let optionSetsLinked = 0;
    let enriched = 0;
    let published = 0;
    const publishedSlugs: string[] = [];
    const classifiedIds: string[] = [];

    if (!DRY_RUN && safe.length > 0) {
      for (let i = 0; i < safe.length; i += BATCH) {
        const batch = safe.slice(i, i + BATCH);
        const ids = batch.map((b) => b.row.id);
        const sports = batch.map((b) => b.resolution.sport!);
        const leagues = batch.map((b) => b.resolution.league ?? "");

        const sportUp = await sql`
          UPDATE products p
          SET sport = v.sport, updated_at = now(), updated_by = 'conflict-resolver'
          FROM (SELECT unnest(${ids}::uuid[]) AS id, unnest(${sports}::text[]) AS sport) v
          WHERE p.id = v.id AND p.status = 'draft' AND p.sport IS NULL
        `;
        classified += sportUp.count;
        classifiedIds.push(...ids);

        const leagueUp = await sql`
          UPDATE products p
          SET league = NULLIF(v.league, ''), updated_at = now(), updated_by = 'conflict-resolver'
          FROM (SELECT unnest(${ids}::uuid[]) AS id, unnest(${leagues}::text[]) AS league) v
          WHERE p.id = v.id AND p.status = 'draft' AND p.league IS NULL AND NULLIF(v.league, '') IS NOT NULL
        `;
        leaguesSet += leagueUp.count;
      }

      await sql`
        INSERT INTO ai_change_log (category, product_id, field_name, previous_value, new_value, reason, confidence, decision, decided_by, decided_at, applied_at, metadata)
        SELECT 'taxonomy', p.id, 'sport', 'null'::jsonb, to_jsonb(p.sport),
          'Conflict resolution: title+tags corroboration (or diacritic-only FIFA match). Title unchanged.',
          '0.92', 'auto_applied', 'conflict-resolver', now(), now(),
          jsonb_build_object('conflictResolver', true)
        FROM products p
        WHERE p.id = ANY(${classifiedIds}::uuid[]) AND p.sport IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM ai_change_log l
            WHERE l.product_id = p.id AND l.decided_by = 'conflict-resolver' AND l.field_name = 'sport'
          )`;

      const enrich = await sql`
        UPDATE products
        SET
          customisation_profile_id = COALESCE(
            customisation_profile_id,
            (SELECT id FROM customisation_profiles WHERE slug = 'jersey-standard' AND deleted_at IS NULL LIMIT 1)
          ),
          size_chart_id = COALESCE(
            size_chart_id,
            (SELECT sc.id FROM size_charts sc WHERE sc.deleted_at IS NULL
              AND (
                (lower(products.sport) = 'football' AND sc.slug = 'nfl-adult')
                OR (lower(products.sport) = 'basketball' AND sc.slug = 'nba-adult')
                OR (lower(products.sport) = 'hockey' AND sc.slug = 'nhl-adult')
                OR (lower(products.sport) = 'baseball' AND sc.slug = 'mlb-adult')
                OR (lower(products.sport) = 'soccer' AND sc.slug = 'soccer-adult')
              ) LIMIT 1)
          ),
          updated_at = now(),
          updated_by = 'conflict-resolver-enrich'
        WHERE id = ANY(${classifiedIds}::uuid[])
          AND status = 'draft'
          AND sport IN ('Football','Basketball','Hockey','Baseball','Soccer')
          AND (size_chart_id IS NULL OR customisation_profile_id IS NULL)
      `;
      enriched = enrich.count;

      const linked = await sql`
        UPDATE products p SET option_set_id = os.id, updated_at = now(), updated_by = 'conflict-resolver-link'
        FROM product_option_sets os
        WHERE p.id = ANY(${classifiedIds}::uuid[])
          AND p.status = 'draft' AND p.option_set_id IS NULL AND os.deleted_at IS NULL
          AND (
            (lower(p.sport) = 'baseball' AND os.slug = 'baseball-jerseys')
            OR (lower(p.sport) = 'hockey' AND os.slug = 'hockey-jerseys')
            OR (lower(p.sport) = 'soccer' AND os.slug = 'soccer-jerseys')
            OR (lower(p.sport) = 'football' AND os.slug = 'football-jerseys')
            OR (lower(p.sport) = 'basketball' AND os.slug = 'basketball-jerseys')
          )`;
      optionSetsLinked = linked.count;
    }

    // Publish only SAFE_TO_FIX with full readiness + option set
    const ready = await sql<{ id: string; slug: string; title: string }[]>`
      WITH sp AS (
        SELECT p.* FROM products p
        WHERE p.deleted_at IS NULL AND p.shopify_id IS NOT NULL AND p.status = 'draft'
          AND p.updated_by IN ('conflict-resolver','conflict-resolver-enrich','conflict-resolver-link')
      ),
      img AS (SELECT product_id, count(*)::int AS n FROM product_images WHERE deleted_at IS NULL GROUP BY product_id),
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
        FROM product_catalogue_signals GROUP BY product_id
      )
      SELECT sp.id, sp.slug, sp.title
      FROM sp
      LEFT JOIN img i ON i.product_id = sp.id
      LEFT JOIN var v ON v.product_id = sp.id
      LEFT JOIN seo s ON s.product_id = sp.id
      LEFT JOIN dup d ON d.product_id = sp.id
      WHERE sp.sport IS NOT NULL
        AND sp.option_set_id IS NOT NULL
        AND sp.size_chart_id IS NOT NULL
        AND sp.customisation_profile_id IS NOT NULL
        AND coalesce(v.has_price, false)
        AND coalesce(v.n, 0) > 0
        AND coalesce(i.n, 0) > 0
        AND coalesce(s.has_meta, false)
        AND (sp.description IS NOT NULL AND trim(sp.description) <> ''
          AND sp.description !~* 'imported draft|content pending review')
        AND NOT coalesce(d.is_dup, false)
    `;

    if (!DRY_RUN && ready.length > 0) {
      for (let i = 0; i < ready.length; i += BATCH) {
        const batch = ready.slice(i, i + BATCH);
        const ids = batch.map((p) => p.id);
        const r = await sql`
          UPDATE products SET status = 'published', updated_at = now(), updated_by = 'conflict-resolver-publish'
          WHERE id = ANY(${ids}::uuid[]) AND status = 'draft'
        `;
        published += r.count;
        publishedSlugs.push(...batch.map((p) => p.slug));
        await sql`
          INSERT INTO ai_change_log (category, product_id, field_name, previous_value, new_value, reason, confidence, decision, decided_by, decided_at, applied_at, metadata)
          SELECT 'taxonomy', p.id, 'status', '"draft"'::jsonb, '"published"'::jsonb,
            'Conflict resolution publish: passed readiness after SAFE_TO_FIX classification.',
            '0.95', 'auto_applied', 'conflict-resolver-publish', now(), now(),
            jsonb_build_object('conflictResolverPublish', true, 'batch', ${Math.floor(i / BATCH) + 1}::int)
          FROM products p WHERE p.id = ANY(${ids}::uuid[]) AND p.status = 'published'`;
      }
    }

    const [ending] = await sql`
      SELECT
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'published')::int AS shopify_published,
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'draft')::int AS shopify_draft
      FROM products WHERE deleted_at IS NULL`;

    const report = {
      startedAt,
      completedAt: new Date().toISOString(),
      dryRun: DRY_RUN,
      starting,
      ending,
      conflictsReviewed: conflictRows.length,
      counts,
      examples,
      applied: DRY_RUN
        ? {
            classified: safe.length,
            leaguesSet: safe.filter((s) => s.resolution.league).length,
            enriched: 0,
            optionSetsLinked: 0,
            published: ready.length
          }
        : { classified, leaguesSet, enriched, optionSetsLinked, published },
      publishedSlugs: DRY_RUN ? ready.map((p) => p.slug) : publishedSlugs,
      products: conflictRows.map(({ row, resolution }) => {
        const wasSafe = resolution.disposition === "SAFE_TO_FIX" && resolution.sport;
        const wasPublished = publishedSlugs.includes(row.slug) || (DRY_RUN && ready.some((r) => r.id === row.id));
        return {
          id: row.id,
          slug: row.slug,
          title: row.title,
          disposition: resolution.disposition,
          sport: resolution.sport,
          league: resolution.league,
          reason: resolution.reason,
          evidence: resolution.evidence,
          action: wasPublished
            ? "classified_enriched_published"
            : wasSafe
              ? DRY_RUN
                ? "would_classify"
                : "classified_kept_draft_or_pending_readiness"
              : "kept_draft"
        };
      })
    };

    writeReport(report);
    console.log(
      JSON.stringify(
        {
          ...report,
          products: undefined,
          productCount: report.products.length
        },
        null,
        2
      )
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function writeReport(report: unknown): void {
  mkdirSync(join(process.cwd(), "../../docs/full-import-logs"), { recursive: true });
  const out = join(process.cwd(), "../../docs/full-import-logs/CONFLICT-RESOLUTION-REPORT.json");
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.error(`wrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
