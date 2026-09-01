/**
 * Final UNKNOWN catalogue evidence pass.
 * Does NOT touch HUMAN_REVIEW or INVALID products.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { classifyCollegeInternationalProduct } from "../college-international-signals";
import { resolveConflictProduct } from "../conflict-resolution-signals";
import {
  classifyFinalUnknown,
  normalizeCollections,
  type FinalUnknownCategory
} from "../final-unknown-catalogue-signals";

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
  vendor: string | null;
  product_type: string | null;
  source_payload: { tags?: unknown; collections?: unknown } | null;
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
    const startingRow = await sql<{ shopify_published: number; shopify_draft: number }[]>`
      SELECT
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'published')::int AS shopify_published,
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'draft')::int AS shopify_draft
      FROM products WHERE deleted_at IS NULL`;
    const starting = startingRow[0] ?? { shopify_published: 0, shopify_draft: 0 };

    const drafts = await sql<Row[]>`
      SELECT id, slug, title, team, league, sport, vendor, product_type, source_payload
      FROM products
      WHERE deleted_at IS NULL AND shopify_id IS NOT NULL AND status = 'draft' AND sport IS NULL
      ORDER BY slug`;

    type Reviewed = { row: Row; result: ReturnType<typeof classifyFinalUnknown> };
    const reviewed: Reviewed[] = [];
    let skippedHumanReview = 0;
    let skippedInvalid = 0;
    let skippedOther = 0;

    for (const row of drafts) {
      const prior = classifyCollegeInternationalProduct({
        title: row.title,
        slug: row.slug,
        team: row.team,
        league: row.league,
        sourcePayload: JSON.stringify(row.source_payload ?? {})
      });
      if (prior.category === "conflict") {
        const d = resolveConflictProduct({
          title: row.title,
          slug: row.slug,
          team: row.team,
          tags: tagsOf(row),
          productType: row.product_type
        });
        if (d.disposition === "HUMAN_REVIEW") {
          skippedHumanReview++;
          continue;
        }
        if (d.disposition === "INVALID_PRODUCT") {
          skippedInvalid++;
          continue;
        }
        continue;
      }
      if (prior.category !== "unknown") {
        skippedOther++;
        continue;
      }

      const result = classifyFinalUnknown({
        title: row.title,
        slug: row.slug,
        tags: tagsOf(row),
        collections: normalizeCollections(row.source_payload?.collections),
        productType: row.product_type,
        vendor: row.vendor,
        team: row.team
      });
      reviewed.push({ row, result });
    }

    const startingUnknown = reviewed.length;
    const resolveList = reviewed.filter(
      (r) => r.result.action === "RESOLVE" && r.result.sport && r.result.hasOptionSet && r.result.isJerseyProduct
    );
    const blockedByCategory: Record<string, number> = {};
    const resolvedByCategory: Record<string, number> = {};
    for (const { result } of reviewed) {
      if (result.action === "RESOLVE") {
        resolvedByCategory[result.category] = (resolvedByCategory[result.category] ?? 0) + 1;
      } else {
        blockedByCategory[result.category] = (blockedByCategory[result.category] ?? 0) + 1;
      }
    }

    console.log(
      JSON.stringify(
        {
          phase: "audit",
          startingUnknown,
          resolveEligible: resolveList.length,
          resolvedByCategory,
          blockedByCategory,
          skippedHumanReview,
          skippedInvalid,
          starting
        },
        null,
        2
      )
    );

    if (AUDIT_ONLY) {
      writeReport(buildReport({
        startedAt,
        starting,
        ending: starting,
        startingUnknown,
        reviewed,
        resolveList,
        publishedSlugs: [],
        classified: 0,
        published: 0,
        skippedHumanReview,
        skippedInvalid,
        unknownRemaining: startingUnknown - resolveList.length,
        humanReviewRemaining: skippedHumanReview,
        invalidRemaining: skippedInvalid
      }));
      return;
    }

    let classified = 0;
    let published = 0;
    const publishedSlugs: string[] = [];
    const classifiedIds: string[] = [];

    if (!DRY_RUN && resolveList.length > 0) {
      for (let i = 0; i < resolveList.length; i += BATCH) {
        const batch = resolveList.slice(i, i + BATCH);
        const ids = batch.map((b) => b.row.id);
        const sports = batch.map((b) => b.result.sport!);
        const leagues = batch.map((b) => b.result.league ?? "");

        const sportUp = await sql`
          UPDATE products p
          SET sport = v.sport, updated_at = now(), updated_by = 'final-unknown-classify'
          FROM (SELECT unnest(${ids}::uuid[]) AS id, unnest(${sports}::text[]) AS sport) v
          WHERE p.id = v.id AND p.status = 'draft' AND p.sport IS NULL`;
        classified += sportUp.count;
        classifiedIds.push(...ids);

        await sql`
          UPDATE products p
          SET league = NULLIF(v.league, ''), updated_at = now(), updated_by = 'final-unknown-classify'
          FROM (SELECT unnest(${ids}::uuid[]) AS id, unnest(${leagues}::text[]) AS league) v
          WHERE p.id = v.id AND p.status = 'draft' AND p.league IS NULL AND NULLIF(v.league, '') IS NOT NULL`;
      }

      await sql`
        INSERT INTO ai_change_log (category, product_id, field_name, previous_value, new_value, reason, confidence, decision, decided_by, decided_at, applied_at, metadata)
        SELECT 'taxonomy', p.id, 'sport', 'null'::jsonb, to_jsonb(p.sport),
          'Final unknown pass: dual-evidence classification. Title unchanged.',
          '0.95', 'auto_applied', 'final-unknown-classify', now(), now(),
          jsonb_build_object('finalUnknownPass', true)
        FROM products p
        WHERE p.id = ANY(${classifiedIds}::uuid[]) AND p.sport IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM ai_change_log l
            WHERE l.product_id = p.id AND l.decided_by = 'final-unknown-classify' AND l.field_name = 'sport'
          )`;

      await sql`
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
          updated_by = 'final-unknown-enrich'
        WHERE id = ANY(${classifiedIds}::uuid[])
          AND status = 'draft'
          AND sport IN ('Football','Basketball','Hockey','Baseball','Soccer')
          AND (size_chart_id IS NULL OR customisation_profile_id IS NULL)`;

      await sql`
        UPDATE products p SET option_set_id = os.id, updated_at = now(), updated_by = 'final-unknown-link'
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
    }

    const ready = await sql<{ id: string; slug: string }[]>`
      WITH sp AS (
        SELECT p.* FROM products p
        WHERE p.deleted_at IS NULL AND p.shopify_id IS NOT NULL AND p.status = 'draft'
          AND p.updated_by IN ('final-unknown-classify','final-unknown-enrich','final-unknown-link')
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
      SELECT sp.id, sp.slug
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
          UPDATE products SET status = 'published', updated_at = now(), updated_by = 'final-unknown-publish'
          WHERE id = ANY(${ids}::uuid[]) AND status = 'draft'`;
        published += r.count;
        publishedSlugs.push(...batch.map((p) => p.slug));
      }
    }

    const endingRow = await sql<{ shopify_published: number; shopify_draft: number }[]>`
      SELECT
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'published')::int AS shopify_published,
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'draft')::int AS shopify_draft
      FROM products WHERE deleted_at IS NULL`;
    const ending = endingRow[0] ?? { shopify_published: 0, shopify_draft: 0 };

    let unknownRemaining = 0;
    let humanReviewRemaining = 0;
    let invalidRemaining = 0;
    const remainingDrafts = await sql<Row[]>`
      SELECT id, slug, title, team, league, sport, vendor, product_type, source_payload
      FROM products
      WHERE deleted_at IS NULL AND shopify_id IS NOT NULL AND status = 'draft' AND sport IS NULL`;

    for (const row of remainingDrafts) {
      const prior = classifyCollegeInternationalProduct({
        title: row.title,
        slug: row.slug,
        team: row.team,
        league: row.league,
        sourcePayload: JSON.stringify(row.source_payload ?? {})
      });
      if (prior.category === "conflict") {
        const d = resolveConflictProduct({
          title: row.title,
          slug: row.slug,
          team: row.team,
          tags: tagsOf(row),
          productType: row.product_type
        });
        if (d.disposition === "HUMAN_REVIEW") humanReviewRemaining++;
        else if (d.disposition === "INVALID_PRODUCT") invalidRemaining++;
        continue;
      }
      if (prior.category === "unknown") unknownRemaining++;
    }

    writeReport(
      buildReport({
        startedAt,
        starting,
        ending,
        startingUnknown,
        reviewed,
        resolveList,
        publishedSlugs: DRY_RUN ? ready.map((p) => p.slug) : publishedSlugs,
        classified: DRY_RUN ? resolveList.length : classified,
        published: DRY_RUN ? ready.length : published,
        skippedHumanReview,
        skippedInvalid,
        unknownRemaining,
        humanReviewRemaining,
        invalidRemaining
      })
    );

    console.log(
      JSON.stringify(
        {
          phase: "done",
          classified: DRY_RUN ? resolveList.length : classified,
          published: DRY_RUN ? ready.length : published,
          unknownRemaining,
          humanReviewRemaining,
          invalidRemaining,
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

function buildReport(input: {
  startedAt: string;
  starting: { shopify_published: number; shopify_draft: number };
  ending: { shopify_published: number; shopify_draft: number };
  startingUnknown: number;
  reviewed: { row: Row; result: ReturnType<typeof classifyFinalUnknown> }[];
  resolveList: { row: Row; result: ReturnType<typeof classifyFinalUnknown> }[];
  publishedSlugs: string[];
  classified: number;
  published: number;
  skippedHumanReview: number;
  skippedInvalid: number;
  unknownRemaining: number;
  humanReviewRemaining: number;
  invalidRemaining: number;
}) {
  const resolvedByCategory: Record<string, number> = {};
  const keptDraftByCategory: Record<string, number> = {};
  const blockers: Record<string, number> = {};

  for (const { result } of input.reviewed) {
    if (result.action === "RESOLVE") {
      resolvedByCategory[result.category] = (resolvedByCategory[result.category] ?? 0) + 1;
    } else {
      keptDraftByCategory[result.category] = (keptDraftByCategory[result.category] ?? 0) + 1;
      const key = result.blocker ?? result.category;
      blockers[key] = (blockers[key] ?? 0) + 1;
    }
  }

  const highSchoolCount = keptDraftByCategory.high_school_blocked ?? 0;
  const nonJerseyCount =
    (keptDraftByCategory.non_jersey_blocked ?? 0) +
    (input.reviewed.filter((r) => r.result.priorGroup === "nba_non_jersey").length > 0
      ? input.reviewed.filter((r) => r.result.category === "non_jersey_blocked" && r.result.priorGroup === "nba_non_jersey").length
      : 0);
  const noveltyCount = keptDraftByCategory.movie_novelty_blocked ?? 0;
  const conflictsRemaining = keptDraftByCategory.conflict_unresolved ?? 0;

  return {
    startedAt: input.startedAt,
    completedAt: new Date().toISOString(),
    starting: input.starting,
    ending: input.ending,
    summary: {
      startingUnknown: input.startingUnknown,
      resolvedTotal: input.classified,
      published: input.published,
      keptDraft: input.startingUnknown - input.classified,
      unknownRemaining: input.unknownRemaining,
      humanReviewRemaining: input.humanReviewRemaining,
      invalidRemaining: input.invalidRemaining,
      highSchoolCount,
      nonJerseyCount: input.reviewed.filter(
        (r) => r.result.priorGroup === "non_jersey" || r.result.priorGroup === "nba_non_jersey"
      ).length,
      noveltyCount,
      conflictsRemaining
    },
    resolvedByCategory,
    keptDraftByCategory,
    blockers,
    recommendedFutureWork: [
      "Define sport-only fulfilment policy for high-school jerseys before any publish",
      "Add non-jersey option sets (shorts/toques) or exclude from catalogue",
      "Movie/novelty lane: sport classification without pro league, manual review",
      "tags_only (~137 remaining): need player→franchise enrichment from Shopify metafields",
      "Resolve remaining title/slug NBA conflicts only when franchise appears in tags",
      "Do not infer sport from Basketball J / Football J tags alone"
    ],
    products: input.reviewed.map(({ row, result }) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      action: result.action,
      category: result.category,
      sport: result.sport,
      league: result.league,
      reason: result.reason,
      blocker: result.blocker,
      evidence: result.evidence,
      priorGroup: result.priorGroup,
      published: input.publishedSlugs.includes(row.slug)
    }))
  };
}

function writeReport(report: Record<string, unknown>): void {
  const dir = join(process.cwd(), "../../docs/full-import-logs");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "FINAL-UNKNOWN-CATALOGUE-AUDIT.json");
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(`Wrote ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
