/**
 * Deep classification of UNKNOWN catalogue drafts only.
 * Does NOT touch HUMAN_REVIEW or INVALID products.
 *
 * Usage:
 *   tsx classify-unknown-deep.ts --audit-only
 *   tsx classify-unknown-deep.ts --dry-run
 *   tsx classify-unknown-deep.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { classifyCollegeInternationalProduct } from "../college-international-signals";
import {
  classifyUnknownDeep,
  normalizeCollections,
  type EvidenceTier,
  type UnknownDeepResult
} from "../unknown-deep-classification-signals";

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
    const [starting] = await sql`
      SELECT
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'published')::int AS shopify_published,
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'draft')::int AS shopify_draft
      FROM products WHERE deleted_at IS NULL`;

    const drafts = await sql<Row[]>`
      SELECT id, slug, title, team, league, sport, vendor, product_type, source_payload
      FROM products
      WHERE deleted_at IS NULL AND shopify_id IS NOT NULL AND status = 'draft' AND sport IS NULL
      ORDER BY slug`;

    type Reviewed = { row: Row; result: UnknownDeepResult };
    const unknownReviewed: Reviewed[] = [];
    let skippedHumanReviewInvalid = 0;
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
        skippedHumanReviewInvalid++;
        continue;
      }
      if (prior.category !== "unknown") {
        skippedOther++;
        continue;
      }

      const result = classifyUnknownDeep({
        title: row.title,
        slug: row.slug,
        tags: tagsOf(row),
        collections: normalizeCollections(row.source_payload?.collections),
        productType: row.product_type,
        vendor: row.vendor,
        team: row.team
      });
      unknownReviewed.push({ row, result });
    }

    const tiers: Record<EvidenceTier, number> = { HIGH: 0, MEDIUM: 0, LOW: 0, CONFLICT: 0 };
    const bySport: Record<string, number> = {};
    const byLeague: Record<string, number> = {};
    const byGroup: Record<string, number> = {};
    for (const { result } of unknownReviewed) {
      tiers[result.tier]++;
      byGroup[result.group] = (byGroup[result.group] ?? 0) + 1;
      if (result.sport) bySport[result.sport] = (bySport[result.sport] ?? 0) + 1;
      if (result.league) byLeague[result.league] = (byLeague[result.league] ?? 0) + 1;
    }

    const high = unknownReviewed.filter(
      (r) => r.result.tier === "HIGH" && r.result.sport && r.result.hasOptionSet && r.result.isJerseyProduct
    );

    console.log(
      JSON.stringify(
        {
          phase: "audit",
          startingUnknown: unknownReviewed.length,
          tiers,
          bySport,
          byLeague,
          byGroup,
          highEligible: high.length,
          skippedHumanReviewInvalid,
          skippedOther,
          starting
        },
        null,
        2
      )
    );

    const groupExamples: Record<string, { title: string; slug: string; tier: string; reason: string }[]> = {};
    for (const { row, result } of unknownReviewed) {
      const list = (groupExamples[result.group] ??= []);
      if (list.length < 5) {
        list.push({ title: row.title, slug: row.slug, tier: result.tier, reason: result.reason });
      }
    }

    if (AUDIT_ONLY) {
      writeReport({
        startedAt,
        completedAt: new Date().toISOString(),
        auditOnly: true,
        starting,
        ending: starting,
        startingUnknown: unknownReviewed.length,
        tiers,
        bySport,
        byLeague,
        byGroup,
        largestRecurringUnknownGroups: Object.entries(byGroup)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([group, count]) => ({ group, count, examples: groupExamples[group] })),
        highEligible: high.length,
        newlyClassified: 0,
        optionSetsLinked: 0,
        published: 0,
        products: unknownReviewed.map((r) => mapProduct(r, false))
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
    const classifiedBySport: Record<string, number> = {};
    const classifiedByLeague: Record<string, number> = {};

    if (!DRY_RUN && high.length > 0) {
      for (let i = 0; i < high.length; i += BATCH) {
        const batch = high.slice(i, i + BATCH);
        const ids = batch.map((b) => b.row.id);
        const sports = batch.map((b) => b.result.sport!);
        const leagues = batch.map((b) => b.result.league ?? "");

        const sportUp = await sql`
          UPDATE products p
          SET sport = v.sport, updated_at = now(), updated_by = 'unknown-deep-classify'
          FROM (SELECT unnest(${ids}::uuid[]) AS id, unnest(${sports}::text[]) AS sport) v
          WHERE p.id = v.id AND p.status = 'draft' AND p.sport IS NULL`;
        classified += sportUp.count;
        classifiedIds.push(...ids);

        const leagueUp = await sql`
          UPDATE products p
          SET league = NULLIF(v.league, ''), updated_at = now(), updated_by = 'unknown-deep-classify'
          FROM (SELECT unnest(${ids}::uuid[]) AS id, unnest(${leagues}::text[]) AS league) v
          WHERE p.id = v.id AND p.status = 'draft' AND p.league IS NULL AND NULLIF(v.league, '') IS NOT NULL`;
        leaguesSet += leagueUp.count;

        for (const b of batch) {
          classifiedBySport[b.result.sport!] = (classifiedBySport[b.result.sport!] ?? 0) + 1;
          if (b.result.league) {
            classifiedByLeague[b.result.league] = (classifiedByLeague[b.result.league] ?? 0) + 1;
          }
        }
      }

      await sql`
        INSERT INTO ai_change_log (category, product_id, field_name, previous_value, new_value, reason, confidence, decision, decided_by, decided_at, applied_at, metadata)
        SELECT 'taxonomy', p.id, 'sport', 'null'::jsonb, to_jsonb(p.sport),
          'Unknown deep classification: HIGH multi-source franchise/sport evidence. Title unchanged.',
          '0.94', 'auto_applied', 'unknown-deep-classify', now(), now(),
          jsonb_build_object('unknownDeepClassify', true)
        FROM products p
        WHERE p.id = ANY(${classifiedIds}::uuid[]) AND p.sport IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM ai_change_log l
            WHERE l.product_id = p.id AND l.decided_by = 'unknown-deep-classify' AND l.field_name = 'sport'
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
          updated_by = 'unknown-deep-enrich'
        WHERE id = ANY(${classifiedIds}::uuid[])
          AND status = 'draft'
          AND sport IN ('Football','Basketball','Hockey','Baseball','Soccer')
          AND (size_chart_id IS NULL OR customisation_profile_id IS NULL)`;
      enriched = enrich.count;

      const linked = await sql`
        UPDATE products p SET option_set_id = os.id, updated_at = now(), updated_by = 'unknown-deep-link'
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

    const ready = await sql<{ id: string; slug: string; title: string }[]>`
      WITH sp AS (
        SELECT p.* FROM products p
        WHERE p.deleted_at IS NULL AND p.shopify_id IS NOT NULL AND p.status = 'draft'
          AND p.updated_by IN ('unknown-deep-classify','unknown-deep-enrich','unknown-deep-link')
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
          UPDATE products SET status = 'published', updated_at = now(), updated_by = 'unknown-deep-publish'
          WHERE id = ANY(${ids}::uuid[]) AND status = 'draft'`;
        published += r.count;
        publishedSlugs.push(...batch.map((p) => p.slug));
        await sql`
          INSERT INTO ai_change_log (category, product_id, field_name, previous_value, new_value, reason, confidence, decision, decided_by, decided_at, applied_at, metadata)
          SELECT 'taxonomy', p.id, 'status', '"draft"'::jsonb, '"published"'::jsonb,
            'Unknown deep classification publish: READY after HIGH-evidence classification.',
            '0.95', 'auto_applied', 'unknown-deep-publish', now(), now(),
            jsonb_build_object('unknownDeepPublish', true)
          FROM products p WHERE p.id = ANY(${ids}::uuid[]) AND p.status = 'published'`;
      }
    }

    const [ending] = await sql`
      SELECT
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'published')::int AS shopify_published,
        count(*) FILTER (WHERE shopify_id IS NOT NULL AND status = 'draft')::int AS shopify_draft
      FROM products WHERE deleted_at IS NULL`;

    // Remaining UNKNOWN / HUMAN / INVALID
    const remainingDrafts = await sql<Row[]>`
      SELECT id, slug, title, team, league, sport, vendor, product_type, source_payload
      FROM products
      WHERE deleted_at IS NULL AND shopify_id IS NOT NULL AND status = 'draft' AND sport IS NULL`;

    let unknownRemaining = 0;
    let humanRemaining = 0;
    let invalidRemaining = 0;
    const remainingGroups: Record<string, number> = {};

    for (const row of remainingDrafts) {
      const prior = classifyCollegeInternationalProduct({
        title: row.title,
        slug: row.slug,
        team: row.team,
        league: row.league,
        sourcePayload: JSON.stringify(row.source_payload ?? {})
      });
      if (prior.category === "conflict") {
        // Count via first-pass disposition lightly: treat all remaining conflicts as HR+invalid pool
        humanRemaining++;
        continue;
      }
      if (prior.category !== "unknown") continue;
      unknownRemaining++;
      const result = classifyUnknownDeep({
        title: row.title,
        slug: row.slug,
        tags: tagsOf(row),
        collections: normalizeCollections(row.source_payload?.collections),
        productType: row.product_type,
        vendor: row.vendor,
        team: row.team
      });
      remainingGroups[result.group] = (remainingGroups[result.group] ?? 0) + 1;
      if (result.tier === "CONFLICT") {
        // stay in unknownRemaining count but track
      }
    }

    // Split conflict drafts into human/invalid using prior report counts roughly:
    // Re-run conflict disposition for accuracy
    humanRemaining = 0;
    invalidRemaining = 0;
    const { resolveConflictProduct } = await import("../conflict-resolution-signals");
    for (const row of remainingDrafts) {
      const prior = classifyCollegeInternationalProduct({
        title: row.title,
        slug: row.slug,
        team: row.team,
        league: row.league,
        sourcePayload: JSON.stringify(row.source_payload ?? {})
      });
      if (prior.category !== "conflict") continue;
      const d = resolveConflictProduct({
        title: row.title,
        slug: row.slug,
        team: row.team,
        tags: tagsOf(row),
        productType: row.product_type
      });
      if (d.disposition === "HUMAN_REVIEW") humanRemaining++;
      else if (d.disposition === "INVALID_PRODUCT") invalidRemaining++;
    }

    const recommendedNextRules = [
      "Expand NCAA school dictionary for basketball/football HIGH when NCAAB/NCAAF tags + school match",
      "Treat high-school / movie jerseys as a dedicated non-pro catalogue lane (sport only, no league)",
      "Resolve title/slug franchise CONFLICTS with tag corroboration of title (second-pass like human-review)",
      "Classify non-jersey NBA merch (shorts/toques) with a dedicated option set or leave unpublishable",
      "Investigate tags_only basketball (~165): may need player-name → franchise enrichment from payload",
      "Do not auto-publish MEDIUM national-team kits without country tag + soccer collection"
    ];

    writeReport({
      startedAt,
      completedAt: new Date().toISOString(),
      dryRun: DRY_RUN,
      starting,
      ending,
      startingUnknown: unknownReviewed.length,
      tiers,
      bySport,
      byLeague,
      byGroup,
      largestRecurringUnknownGroups: Object.entries(byGroup)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([group, count]) => ({ group, count, examples: groupExamples[group] })),
      remainingUnknownGroups: Object.entries(remainingGroups)
        .sort((a, b) => b[1] - a[1])
        .map(([group, count]) => ({ group, count })),
      newlyClassifiedBySport: classifiedBySport,
      newlyClassifiedByLeague: classifiedByLeague,
      newlyClassified: DRY_RUN ? high.length : classified,
      leaguesSet: DRY_RUN ? high.filter((h) => h.result.league).length : leaguesSet,
      enriched: DRY_RUN ? 0 : enriched,
      optionSetsLinked: DRY_RUN ? 0 : optionSetsLinked,
      published: DRY_RUN ? ready.length : published,
      publishedSlugs: DRY_RUN ? ready.map((p) => p.slug) : publishedSlugs,
      keptDraft:
        unknownReviewed.length - (DRY_RUN ? high.length : classified) +
        (DRY_RUN ? high.length - ready.length : classified - published),
      unknownRemaining,
      humanReviewRemaining: humanRemaining,
      invalidRemaining,
      recommendedNextClassificationRules: recommendedNextRules,
      products: unknownReviewed.map((r) =>
        mapProduct(
          r,
          publishedSlugs.includes(r.row.slug) || (DRY_RUN && ready.some((x) => x.id === r.row.id))
        )
      )
    });

    console.log(
      JSON.stringify(
        {
          phase: "done",
          classified: DRY_RUN ? high.length : classified,
          published: DRY_RUN ? ready.length : published,
          unknownRemaining,
          humanRemaining,
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

function mapProduct(r: { row: Row; result: UnknownDeepResult }, published: boolean) {
  const applied =
    r.result.tier === "HIGH" && r.result.sport && r.result.hasOptionSet && r.result.isJerseyProduct
      ? published
        ? "classified_enriched_published"
        : "classified_enriched_kept_draft"
      : "left_draft";
  return {
    id: r.row.id,
    slug: r.row.slug,
    title: r.row.title,
    tier: r.result.tier,
    sport: r.result.sport,
    league: r.result.league,
    group: r.result.group,
    reason: r.result.reason,
    evidence: r.result.evidence,
    action: applied
  };
}

function writeReport(report: Record<string, unknown>): void {
  const dir = join(process.cwd(), "../../docs/full-import-logs");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "UNKNOWN-DEEP-CLASSIFICATION-REPORT.json");
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(`Wrote ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
