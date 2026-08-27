/**
 * Second-pass HUMAN_REVIEW + INVALID_PRODUCT resolution.
 * Does NOT touch UNKNOWN products.
 *
 * Usage:
 *   tsx resolve-human-review.ts --audit-only
 *   tsx resolve-human-review.ts --dry-run
 *   tsx resolve-human-review.ts
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
import {
  normalizeCollections,
  resolveHumanReviewProduct
} from "../human-review-resolution-signals";

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
  source_payload: { tags?: unknown; collections?: unknown } | null;
};

function tagsOf(row: Row): string[] {
  const raw = row.source_payload?.tags;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") return raw.split(",").map((t) => t.trim()).filter(Boolean);
  return [];
}

function collectionsOf(row: Row): string[] {
  return normalizeCollections(row.source_payload?.collections);
}

async function main(): Promise<void> {
  const sql = postgres(pgUrl(), { max: 1, prepare: false, ssl: "require", connect_timeout: 120 });
  const startedAt = new Date().toISOString();

  try {
    const [starting] = await sql`
      SELECT
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'published')::int AS shopify_published,
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'draft')::int AS shopify_draft,
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'draft' AND sport IS NULL)::int AS draft_null_sport
      FROM products WHERE deleted_at IS NULL`;

    const drafts = await sql<Row[]>`
      SELECT id, slug, title, team, league, sport, product_type, source_payload
      FROM products
      WHERE deleted_at IS NULL AND shopify_id IS NOT NULL AND status = 'draft' AND sport IS NULL
      ORDER BY slug`;

    type Reviewed = {
      row: Row;
      firstPass: ConflictResolution;
      final: ConflictResolution;
      unknownSkipped: boolean;
    };

    const reviewed: Reviewed[] = [];
    let unknownApprox = 0;

    for (const row of drafts) {
      const prior = classifyCollegeInternationalProduct({
        title: row.title,
        slug: row.slug,
        team: row.team,
        league: row.league,
        sourcePayload: JSON.stringify(row.source_payload ?? {})
      });
      if (prior.category === "unknown") {
        unknownApprox++;
        continue;
      }
      if (prior.category !== "conflict") continue;

      const firstPass = resolveConflictProduct({
        title: row.title,
        slug: row.slug,
        team: row.team,
        tags: tagsOf(row),
        productType: row.product_type
      });

      if (firstPass.disposition === "SAFE_TO_FIX") {
        // First-pass already safe — leave for conflict CLI; do not double-apply here
        continue;
      }

      const final = resolveHumanReviewProduct({
        title: row.title,
        slug: row.slug,
        team: row.team,
        tags: tagsOf(row),
        collections: collectionsOf(row),
        productType: row.product_type,
        priorDisposition: firstPass.disposition,
        priorReason: firstPass.reason
      });

      reviewed.push({ row, firstPass, final, unknownSkipped: false });
    }

    const counts: Record<ConflictDisposition, number> = {
      SAFE_TO_FIX: 0,
      HUMAN_REVIEW: 0,
      INVALID_PRODUCT: 0
    };
    for (const r of reviewed) counts[r.final.disposition]++;

    console.log(
      JSON.stringify(
        {
          phase: "audit",
          reviewed: reviewed.length,
          counts,
          unknownApproxUntouched: unknownApprox,
          starting
        },
        null,
        2
      )
    );

    const safe = reviewed.filter(
      (r) => r.final.disposition === "SAFE_TO_FIX" && r.final.sport && r.final.hasOptionSet
    );
    const classifyOnly = reviewed.filter(
      (r) => r.final.disposition === "SAFE_TO_FIX" && r.final.sport && !r.final.hasOptionSet
    );

    if (AUDIT_ONLY) {
      writeReport({
        startedAt,
        completedAt: new Date().toISOString(),
        auditOnly: true,
        starting,
        ending: starting,
        reviewed: reviewed.length,
        counts,
        unknownApproxUntouched: unknownApprox,
        safelyResolved: 0,
        published: 0,
        remainingHumanReview: counts.HUMAN_REVIEW,
        remainingInvalid: counts.INVALID_PRODUCT,
        products: reviewed.map((r) => mapProduct(r, false))
      });
      return;
    }

    let classified = 0;
    let leaguesSet = 0;
    let enriched = 0;
    let optionSetsLinked = 0;
    let published = 0;
    const publishedSlugs: string[] = [];
    const classifiedIds: string[] = [];

    const toClassify = [...safe, ...classifyOnly];

    if (!DRY_RUN && toClassify.length > 0) {
      for (let i = 0; i < toClassify.length; i += BATCH) {
        const batch = toClassify.slice(i, i + BATCH);
        const ids = batch.map((b) => b.row.id);
        const sports = batch.map((b) => b.final.sport!);
        const leagues = batch.map((b) => b.final.league ?? "");

        const sportUp = await sql`
          UPDATE products p
          SET sport = v.sport, updated_at = now(), updated_by = 'human-review-resolver'
          FROM (SELECT unnest(${ids}::uuid[]) AS id, unnest(${sports}::text[]) AS sport) v
          WHERE p.id = v.id AND p.status = 'draft' AND p.sport IS NULL`;
        classified += sportUp.count;
        classifiedIds.push(...ids);

        const leagueUp = await sql`
          UPDATE products p
          SET league = NULLIF(v.league, ''), updated_at = now(), updated_by = 'human-review-resolver'
          FROM (SELECT unnest(${ids}::uuid[]) AS id, unnest(${leagues}::text[]) AS league) v
          WHERE p.id = v.id AND p.status = 'draft' AND p.league IS NULL AND NULLIF(v.league, '') IS NOT NULL`;
        leaguesSet += leagueUp.count;
      }

      await sql`
        INSERT INTO ai_change_log (category, product_id, field_name, previous_value, new_value, reason, confidence, decision, decided_by, decided_at, applied_at, metadata)
        SELECT 'taxonomy', p.id, 'sport', 'null'::jsonb, to_jsonb(p.sport),
          'Human-review second pass: strong multi-source corroboration. Title unchanged.',
          '0.93', 'auto_applied', 'human-review-resolver', now(), now(),
          jsonb_build_object('humanReviewResolver', true)
        FROM products p
        WHERE p.id = ANY(${classifiedIds}::uuid[]) AND p.sport IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM ai_change_log l
            WHERE l.product_id = p.id AND l.decided_by = 'human-review-resolver' AND l.field_name = 'sport'
          )`;

      // Enrich + link only sports with Aris option sets
      const withOptions = toClassify.filter((t) => t.final.hasOptionSet).map((t) => t.row.id);
      if (withOptions.length > 0) {
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
            updated_by = 'human-review-enrich'
          WHERE id = ANY(${withOptions}::uuid[])
            AND status = 'draft'
            AND sport IN ('Football','Basketball','Hockey','Baseball','Soccer')
            AND (size_chart_id IS NULL OR customisation_profile_id IS NULL)`;
        enriched = enrich.count;

        const linked = await sql`
          UPDATE products p SET option_set_id = os.id, updated_at = now(), updated_by = 'human-review-link'
          FROM product_option_sets os
          WHERE p.id = ANY(${withOptions}::uuid[])
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
    }

    const ready = await sql<{ id: string; slug: string; title: string }[]>`
      WITH sp AS (
        SELECT p.* FROM products p
        WHERE p.deleted_at IS NULL AND p.shopify_id IS NOT NULL AND p.status = 'draft'
          AND p.updated_by IN ('human-review-resolver','human-review-enrich','human-review-link')
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
        AND NOT coalesce(d.is_dup, false)`;

    if (!DRY_RUN && ready.length > 0) {
      for (let i = 0; i < ready.length; i += BATCH) {
        const batch = ready.slice(i, i + BATCH);
        const ids = batch.map((p) => p.id);
        const r = await sql`
          UPDATE products SET status = 'published', updated_at = now(), updated_by = 'human-review-publish'
          WHERE id = ANY(${ids}::uuid[]) AND status = 'draft'`;
        published += r.count;
        publishedSlugs.push(...batch.map((p) => p.slug));
        await sql`
          INSERT INTO ai_change_log (category, product_id, field_name, previous_value, new_value, reason, confidence, decision, decided_by, decided_at, applied_at, metadata)
          SELECT 'taxonomy', p.id, 'status', '"draft"'::jsonb, '"published"'::jsonb,
            'Human-review second pass publish: READY after strong-evidence classification.',
            '0.95', 'auto_applied', 'human-review-publish', now(), now(),
            jsonb_build_object('humanReviewPublish', true)
          FROM products p WHERE p.id = ANY(${ids}::uuid[]) AND p.status = 'published'`;
      }
    }

    const [ending] = await sql`
      SELECT
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'published')::int AS shopify_published,
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'draft')::int AS shopify_draft,
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'draft' AND sport IS NULL)::int AS draft_null_sport
      FROM products WHERE deleted_at IS NULL`;

    // Recompute remaining dispositions on still-null-sport conflicts
    const remainingDrafts = await sql<Row[]>`
      SELECT id, slug, title, team, league, sport, product_type, source_payload
      FROM products
      WHERE deleted_at IS NULL AND shopify_id IS NOT NULL AND status = 'draft' AND sport IS NULL`;
    let remainingHuman = 0;
    let remainingInvalid = 0;
    let unknownEnd = 0;
    for (const row of remainingDrafts) {
      const prior = classifyCollegeInternationalProduct({
        title: row.title,
        slug: row.slug,
        team: row.team,
        league: row.league,
        sourcePayload: JSON.stringify(row.source_payload ?? {})
      });
      if (prior.category === "unknown") {
        unknownEnd++;
        continue;
      }
      if (prior.category !== "conflict") continue;
      const firstPass = resolveConflictProduct({
        title: row.title,
        slug: row.slug,
        team: row.team,
        tags: tagsOf(row),
        productType: row.product_type
      });
      if (firstPass.disposition === "SAFE_TO_FIX") continue;
      const final = resolveHumanReviewProduct({
        title: row.title,
        slug: row.slug,
        team: row.team,
        tags: tagsOf(row),
        collections: collectionsOf(row),
        productType: row.product_type,
        priorDisposition: firstPass.disposition,
        priorReason: firstPass.reason
      });
      if (final.disposition === "HUMAN_REVIEW") remainingHuman++;
      else if (final.disposition === "INVALID_PRODUCT") remainingInvalid++;
    }

    writeReport({
      startedAt,
      completedAt: new Date().toISOString(),
      dryRun: DRY_RUN,
      starting,
      ending,
      reviewed: reviewed.length,
      counts,
      unknownApproxUntouched: unknownApprox,
      unknownEnd,
      safelyResolved: toClassify.length,
      classified,
      leaguesSet,
      enriched,
      optionSetsLinked,
      published: DRY_RUN ? ready.length : published,
      publishedSlugs: DRY_RUN ? ready.map((p) => p.slug) : publishedSlugs,
      remainingHumanReview: remainingHuman,
      remainingInvalid,
      classifyOnlyNoPublish: classifyOnly.map((c) => ({
        id: c.row.id,
        slug: c.row.slug,
        title: c.row.title,
        sport: c.final.sport,
        reason: c.final.reason
      })),
      products: reviewed.map((r) =>
        mapProduct(r, publishedSlugs.includes(r.row.slug) || (DRY_RUN && ready.some((x) => x.id === r.row.id)))
      )
    });

    console.log(
      JSON.stringify(
        {
          phase: "done",
          classified,
          published: DRY_RUN ? ready.length : published,
          remainingHuman,
          remainingInvalid,
          unknownEnd,
          ending
        },
        null,
        2
      )
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function mapProduct(
  r: {
    row: Row;
    firstPass: ConflictResolution;
    final: ConflictResolution;
  },
  published = false
) {
  const applied =
    r.final.disposition === "SAFE_TO_FIX" && r.final.sport
      ? published
        ? "classified_enriched_published"
        : r.final.hasOptionSet
          ? "classified_enriched_kept_draft"
          : "classified_no_option_set_kept_draft"
      : "left_draft";
  return {
    id: r.row.id,
    slug: r.row.slug,
    title: r.row.title,
    firstPassDisposition: r.firstPass.disposition,
    disposition: r.final.disposition,
    sport: r.final.sport,
    league: r.final.league,
    reason: r.final.reason,
    evidence: {
      tags: r.final.evidence.tags,
      titleSports: r.final.evidence.titleSports,
      slugSports: r.final.evidence.slugSports,
      firstPassReason: r.firstPass.reason
    },
    action: applied
  };
}

function writeReport(report: Record<string, unknown>): void {
  const dir = join(process.cwd(), "../../docs/full-import-logs");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "HUMAN-REVIEW-RESOLUTION-REPORT.json");
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(`Wrote ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
