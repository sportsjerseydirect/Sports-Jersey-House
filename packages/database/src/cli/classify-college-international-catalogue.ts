/**
 * College + international sport classification, enrichment, option-set linking,
 * and safe autonomous publish for Shopify draft products.
 *
 * Usage:
 *   tsx classify-college-international-catalogue.ts --audit-only
 *   tsx classify-college-international-catalogue.ts --dry-run
 *   tsx classify-college-international-catalogue.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import {
  classifyCollegeInternationalProduct,
  type ClassificationCategory,
  type ClassificationResult
} from "../college-international-signals";

const AUDIT_ONLY = process.argv.includes("--audit-only");
const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 200;

function pgUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  return url.replace(":6543/", ":5432/");
}

type DraftRow = {
  id: string;
  slug: string;
  title: string;
  team: string | null;
  league: string | null;
  sport: string | null;
  source_payload: unknown;
};

function classifyRow(row: DraftRow): ClassificationResult {
  return classifyCollegeInternationalProduct({
    title: row.title,
    slug: row.slug,
    team: row.team,
    league: row.league,
    sourcePayload: JSON.stringify(row.source_payload ?? {})
  });
}

function hasTitleSlugDataConflict(title: string, slug: string): boolean {
  const t = title.toLowerCase();
  const s = slug.toLowerCase();
  if (t.includes("baseball") && (s.includes("bucks") || s.includes("lakers") || s.includes("nba"))) return true;
  if (t.includes("basketball") && (s.includes("dodgers") || s.includes("yankees") || s.includes("mlb"))) return true;
  return false;
}

async function main(): Promise<void> {
  const sql = postgres(pgUrl(), { max: 1, prepare: false, ssl: "require", connect_timeout: 120 });
  const startedAt = new Date().toISOString();

  try {
    const [startingRow] = await sql`
      SELECT
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'published')::int AS shopify_published,
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'draft')::int AS shopify_draft
      FROM products WHERE deleted_at IS NULL`;
    const starting = startingRow ?? { shopify_published: 0, shopify_draft: 0 };

    const drafts = await sql<DraftRow[]>`
      SELECT id, slug, title, team, league, sport, source_payload
      FROM products
      WHERE deleted_at IS NULL AND shopify_id IS NOT NULL AND status = 'draft'
      ORDER BY slug`;

    const audit: Record<ClassificationCategory | "unknown", number> = {
      college_slug_prefix: 0,
      college_explicit_sport: 0,
      international_explicit: 0,
      other_sport_no_options: 0,
      conflict: 0,
      unknown: 0
    };

    const bySport: Record<string, number> = {};
    const examples: Record<string, { slug: string; title: string; evidence: string }[]> = {};
    const toApply: { id: string; sport: string; league: string | null; evidence: string; category: string }[] = [];

    for (const row of drafts) {
      if (row.sport) continue;
      const c = classifyRow(row);
      audit[c.category] = (audit[c.category] ?? 0) + 1;

      if (c.sport) {
        bySport[c.sport] = (bySport[c.sport] ?? 0) + 1;
        if (c.category !== "conflict" && c.category !== "unknown") {
          toApply.push({
            id: row.id,
            sport: c.sport,
            league: c.league,
            evidence: c.evidence,
            category: c.category
          });
        }
      }

      const exKey = c.category;
      if (!examples[exKey]) examples[exKey] = [];
      if (examples[exKey]!.length < 5) {
        examples[exKey]!.push({ slug: row.slug, title: row.title, evidence: c.evidence });
      }
    }

    const auditSummary = {
      totalDrafts: drafts.length,
      nullSportDrafts: drafts.filter((d) => !d.sport).length,
      audit,
      bySport,
      applyCandidates: toApply.length,
      examples
    };

    console.log(JSON.stringify({ phase: "audit", auditSummary }, null, 2));

    if (AUDIT_ONLY) {
      const report = { startedAt, completedAt: new Date().toISOString(), auditOnly: true, starting, auditSummary };
      writeReport(report);
      return;
    }

    let classified = 0;
    let leaguesSet = 0;

    if (!DRY_RUN && toApply.length > 0) {
      for (let i = 0; i < toApply.length; i += BATCH_SIZE) {
        const batch = toApply.slice(i, i + BATCH_SIZE);
        const ids = batch.map((r) => r.id);
        const sports = batch.map((r) => r.sport);
        const leagues = batch.map((r) => r.league ?? "");

        const sportUp = await sql`
          UPDATE products p
          SET sport = v.sport, updated_at = now(), updated_by = 'college-intl-classifier'
          FROM (
            SELECT unnest(${ids}::uuid[]) AS id, unnest(${sports}::text[]) AS sport
          ) v
          WHERE p.id = v.id AND p.sport IS NULL AND p.status = 'draft'
        `;
        classified += sportUp.count;

        const leagueUp = await sql`
          UPDATE products p
          SET league = NULLIF(v.league, ''), updated_at = now(), updated_by = 'college-intl-classifier'
          FROM (
            SELECT unnest(${ids}::uuid[]) AS id, unnest(${leagues}::text[]) AS league
          ) v
          WHERE p.id = v.id AND p.league IS NULL AND p.status = 'draft' AND NULLIF(v.league, '') IS NOT NULL
        `;
        leaguesSet += leagueUp.count;
      }

      await sql`
        INSERT INTO ai_change_log (category, product_id, field_name, previous_value, new_value, reason, confidence, decision, decided_by, decided_at, applied_at, metadata)
        SELECT 'taxonomy', p.id, 'sport',
          'null'::jsonb,
          to_jsonb(p.sport),
          'College/international deterministic sport classification. Title unchanged.',
          '0.90', 'auto_applied', 'college-intl-classifier', now(), now(),
          jsonb_build_object('collegeIntlClassifier', true)
        FROM products p
        WHERE p.updated_by = 'college-intl-classifier' AND p.sport IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM ai_change_log l
            WHERE l.product_id = p.id AND l.decided_by = 'college-intl-classifier' AND l.field_name = 'sport'
          )`;
    }

    // Enrich all classified drafts missing size charts / customisation
    let enriched = 0;
    if (!DRY_RUN) {
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
          updated_by = 'college-intl-enrich'
        WHERE deleted_at IS NULL AND shopify_id IS NOT NULL AND status = 'draft'
          AND sport IS NOT NULL
          AND sport IN ('Football','Basketball','Hockey','Baseball','Soccer')
          AND (size_chart_id IS NULL OR customisation_profile_id IS NULL)
      `;
      enriched = enrich.count;
    }

    let optionSetsLinked = 0;
    if (!DRY_RUN) {
      const linked = await sql`
        UPDATE products p SET option_set_id = os.id, updated_at = now(), updated_by = 'college-intl-link'
        FROM product_option_sets os
        WHERE p.deleted_at IS NULL AND p.shopify_id IS NOT NULL AND p.status = 'draft'
          AND p.option_set_id IS NULL AND os.deleted_at IS NULL
          AND p.sport IS NOT NULL
          AND (
            (lower(p.sport) = 'baseball' AND os.slug = 'baseball-jerseys')
            OR (lower(p.sport) = 'hockey' AND os.slug = 'hockey-jerseys')
            OR (lower(p.sport) = 'soccer' AND os.slug = 'soccer-jerseys')
            OR (lower(p.sport) = 'football' AND os.slug = 'football-jerseys')
            OR (lower(p.sport) = 'basketball' AND os.slug = 'basketball-jerseys')
          )`;
      optionSetsLinked = linked.count;
    }

    // Ready candidates for publish
    const readyCandidates = await sql<{ id: string; slug: string; title: string; sport: string | null }[]>`
      WITH sp AS (
        SELECT p.* FROM products p
        WHERE p.deleted_at IS NULL AND p.shopify_id IS NOT NULL AND p.status = 'draft'
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
      ),
      enriched AS (
        SELECT sp.id, sp.slug, sp.title, sp.sport,
          (sp.title IS NOT NULL AND trim(sp.title) <> '') AS ok_title,
          (sp.slug IS NOT NULL AND trim(sp.slug) <> '') AS ok_slug,
          coalesce(v.has_price, false) AS ok_price,
          coalesce(v.n, 0) > 0 AS ok_variants,
          coalesce(i.n, 0) > 0 AS ok_images,
          coalesce(s.has_meta, false) AS ok_seo,
          sp.size_chart_id IS NOT NULL AS ok_size_chart,
          sp.customisation_profile_id IS NOT NULL AS ok_customisation,
          sp.option_set_id IS NOT NULL AS ok_option_set,
          sp.sport IS NOT NULL AS ok_sport,
          (sp.description IS NOT NULL AND trim(sp.description) <> ''
            AND sp.description !~* 'imported draft|content pending review') AS ok_description,
          coalesce(d.is_dup, false) AS is_duplicate_suspect
        FROM sp
        LEFT JOIN img i ON i.product_id = sp.id
        LEFT JOIN var v ON v.product_id = sp.id
        LEFT JOIN seo s ON s.product_id = sp.id
        LEFT JOIN dup d ON d.product_id = sp.id
      )
      SELECT id, slug, title, sport FROM enriched
      WHERE ok_title AND ok_slug AND ok_price AND ok_variants AND ok_images
        AND ok_seo AND ok_size_chart AND ok_customisation AND ok_option_set
        AND ok_sport AND ok_description AND NOT is_duplicate_suspect
    `;

    const blocklisted = readyCandidates.filter((p) => hasTitleSlugDataConflict(p.title, p.slug));
    const toPublish = readyCandidates.filter((p) => !blocklisted.some((b) => b.id === p.id));

    let published = 0;
    const publishedSlugs: string[] = [];

    if (!DRY_RUN && toPublish.length > 0) {
      for (let i = 0; i < toPublish.length; i += BATCH_SIZE) {
        const batch = toPublish.slice(i, i + BATCH_SIZE);
        const ids = batch.map((p) => p.id);
        const r = await sql`
          UPDATE products SET status = 'published', updated_at = now(), updated_by = 'college-intl-publish'
          WHERE id = ANY(${ids}::uuid[]) AND status = 'draft' AND shopify_id IS NOT NULL
        `;
        published += r.count;
        publishedSlugs.push(...batch.map((p) => p.slug));

        await sql`
          INSERT INTO ai_change_log (category, product_id, field_name, previous_value, new_value, reason, confidence, decision, decided_by, decided_at, applied_at, metadata)
          SELECT 'taxonomy', p.id, 'status', '"draft"'::jsonb, '"published"'::jsonb,
            'College/international publish: passed server-side readiness checklist.',
            '0.95', 'auto_applied', 'college-intl-publish', now(), now(),
            jsonb_build_object('collegeIntlPublish', true, 'batch', ${Math.floor(i / BATCH_SIZE) + 1}::int)
          FROM products p WHERE p.id = ANY(${ids}::uuid[]) AND p.status = 'published'`;
      }
    }

    const [endingRow] = await sql`
      SELECT
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'published')::int AS shopify_published,
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'draft')::int AS shopify_draft
      FROM products WHERE deleted_at IS NULL`;
    const ending = endingRow ?? { shopify_published: 0, shopify_draft: 0 };

    const draftReasons = await sql`
      WITH d AS (
        SELECT p.* FROM products p
        WHERE p.deleted_at IS NULL AND p.shopify_id IS NOT NULL AND p.status = 'draft'
      ),
      img AS (SELECT product_id, count(*)::int AS n FROM product_images WHERE deleted_at IS NULL GROUP BY product_id),
      var AS (
        SELECT product_id, bool_or(price_amount IS NOT NULL AND price_amount::numeric > 0) AS has_price
        FROM product_variants WHERE deleted_at IS NULL GROUP BY product_id
      ),
      scored AS (
        SELECT d.id,
          (d.sport IS NULL) AS missing_sport,
          (d.option_set_id IS NULL AND d.sport IN ('Football','Basketball','Hockey','Baseball','Soccer')) AS missing_option_set,
          (d.size_chart_id IS NULL AND d.sport IN ('Football','Basketball','Hockey','Baseball','Soccer')) AS missing_size_chart,
          (d.sport IN ('Volleyball','Lacrosse','Softball','Cricket','Rugby','Wrestling')) AS other_sport_no_options,
          coalesce(i.n, 0) = 0 AS missing_image
        FROM d LEFT JOIN img i ON i.product_id = d.id LEFT JOIN var v ON v.product_id = d.id
      ),
      primary_reason AS (
        SELECT *,
          CASE
            WHEN missing_image THEN 'missing_image'
            WHEN missing_sport THEN 'missing_sport'
            WHEN other_sport_no_options THEN 'other_sport_no_option_set'
            WHEN missing_option_set THEN 'missing_option_set'
            WHEN missing_size_chart THEN 'missing_size_chart'
            ELSE 'other'
          END AS primary_reason
        FROM scored
      )
      SELECT primary_reason, count(*)::int AS n FROM primary_reason GROUP BY 1 ORDER BY n DESC`;

    const classifiedBySport = await sql`
      SELECT sport, count(*)::int AS n FROM products
      WHERE deleted_at IS NULL AND shopify_id IS NOT NULL AND status = 'draft' AND sport IS NOT NULL
      GROUP BY 1 ORDER BY n DESC`;

    const report = {
      startedAt,
      completedAt: new Date().toISOString(),
      dryRun: DRY_RUN,
      starting,
      ending,
      audit: auditSummary,
      applied: DRY_RUN
        ? { classified: toApply.length, leaguesSet: toApply.filter((r) => r.league).length, enriched: 0, optionSetsLinked: 0, published: toPublish.length }
        : { classified, leaguesSet, enriched, optionSetsLinked, published },
      publish: {
        readyCandidates: readyCandidates.length,
        blocklisted: blocklisted.map((p) => ({ slug: p.slug, reason: "title/slug data conflict" })),
        publishedSlugs: DRY_RUN ? toPublish.map((p) => p.slug) : publishedSlugs
      },
      remainingDraftReasons: draftReasons,
      classifiedDraftsBySport: classifiedBySport,
      humanReview: {
        conflicts: audit.conflict,
        unknown: audit.unknown,
        otherSportNoOptions: audit.other_sport_no_options
      }
    };

    writeReport(report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function writeReport(report: unknown): void {
  mkdirSync(join(process.cwd(), "../../docs/full-import-logs"), { recursive: true });
  const outPath = join(process.cwd(), "../../docs/full-import-logs/COLLEGE-INTERNATIONAL-CATALOGUE-REPORT.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.error(`wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
