/**
 * Full SJD catalogue migration pipeline.
 * IMPORT → ENRICH → READINESS → PUBLISH (safe only) → QA
 */
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabaseClient, computeProductSignals, products } from "@sjh/database";
import { and, gt, isNull, sql } from "drizzle-orm";
import {
  extractAllCollections,
  runControlledFullImport,
  syncProductCollectionMembershipsFromSourcePayload
} from "../index";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const LOG_DIR = join(ROOT, "docs/full-import-logs");
const LOG_FILE = join(LOG_DIR, `migration-${new Date().toISOString().slice(0, 10)}.log`);

function log(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.error(line);
  mkdirSync(LOG_DIR, { recursive: true });
  appendFileSync(LOG_FILE, `${line}\n`);
}

function pgUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  return url.replace(":6543/", ":5432/");
}

async function runTsx(relativePath: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = join(ROOT, relativePath);
    const child = spawn("npx", ["tsx", "--env-file", join(ROOT, ".env"), script, ...args], {
      cwd: ROOT,
      env: {
        ...process.env,
        ENABLE_SHOPIFY_FULL_IMPORT: "true",
        ENABLE_SHOPIFY_SAMPLE_IMPORT: "true",
        ENABLE_SHOPIFY_SYNC: "false"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout?.on("data", (chunk: Buffer) => log(chunk.toString().trim()));
    child.stderr?.on("data", (chunk: Buffer) => log(chunk.toString().trim()));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${relativePath} exited ${code}`));
    });
  });
}

async function baselineStats(): Promise<Record<string, unknown>> {
  const db = createDatabaseClient(pgUrl());
  const [counts] = await db.execute(sql`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE shopify_id IS NOT NULL)::int AS shopify,
      count(*) FILTER (WHERE status = 'published')::int AS published,
      count(*) FILTER (WHERE status = 'draft')::int AS draft
    FROM products WHERE deleted_at IS NULL`);
  return (counts as Record<string, unknown>) ?? {};
}

async function linkOptionSets(): Promise<number> {
  const db = createDatabaseClient(pgUrl());
  const result = await db.execute(sql`
    UPDATE products p
    SET option_set_id = os.id, updated_at = now(), updated_by = 'full-migration'
    FROM product_option_sets os
    WHERE p.deleted_at IS NULL AND p.shopify_id IS NOT NULL AND p.option_set_id IS NULL
      AND os.deleted_at IS NULL
      AND (
        (lower(coalesce(p.sport, '')) = 'baseball' AND os.slug = 'baseball-jerseys')
        OR (lower(coalesce(p.sport, '')) = 'hockey' AND os.slug = 'hockey-jerseys')
        OR (lower(coalesce(p.sport, '')) = 'soccer' AND os.slug = 'soccer-jerseys')
      )`);
  return Number((result as { count?: number }).count ?? 0);
}

async function batchComputeSignals(batchSize = 200): Promise<number> {
  const db = createDatabaseClient(pgUrl());
  let processed = 0;
  let lastId = "00000000-0000-0000-0000-000000000000";

  while (true) {
    const rows = await db
      .select({ id: products.id })
      .from(products)
      .where(and(isNull(products.deletedAt), sql`${products.shopifyId} is not null`, gt(products.id, lastId)))
      .orderBy(products.id)
      .limit(batchSize);

    if (rows.length === 0) break;
    for (const row of rows) {
      await computeProductSignals(row.id, pgUrl());
      processed += 1;
      lastId = row.id;
    }
    log(`signals progress ${processed}`);
  }
  return processed;
}

async function finalStats(): Promise<Record<string, unknown>> {
  const db = createDatabaseClient(pgUrl());
  const summary = await db.execute(sql`
    WITH sp AS (
      SELECT p.* FROM products p WHERE p.deleted_at IS NULL AND p.shopify_id IS NOT NULL
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
    enriched AS (
      SELECT sp.id, sp.status,
        (sp.title IS NOT NULL AND trim(sp.title) <> '') AS ok_title,
        coalesce(v.has_price, false) AS ok_price,
        coalesce(v.n, 0) > 0 AS ok_variants,
        coalesce(i.n, 0) > 0 AS ok_images,
        coalesce(s.has_meta, false) AS ok_seo,
        sp.size_chart_id IS NOT NULL AS ok_size_chart,
        sp.customisation_profile_id IS NOT NULL AS ok_customisation,
        (sp.sport IS NOT NULL OR sp.league IS NOT NULL OR sp.team IS NOT NULL) AS ok_taxonomy,
        (sp.description IS NOT NULL AND trim(sp.description) <> '') AS ok_description,
        sp.option_set_id IS NOT NULL AS ok_option_set
      FROM sp
      LEFT JOIN img i ON i.product_id = sp.id
      LEFT JOIN var v ON v.product_id = sp.id
      LEFT JOIN seo s ON s.product_id = sp.id
    ),
    classified AS (
      SELECT *,
        NOT (ok_title AND ok_price AND ok_variants AND ok_images) AS is_blocked,
        (ok_title AND ok_price AND ok_variants AND ok_images)
          AND NOT (ok_seo AND ok_size_chart AND ok_customisation AND ok_taxonomy AND ok_description AND ok_option_set) AS needs_review
      FROM enriched
    )
    SELECT
      count(*)::int AS total_shopify,
      count(*) FILTER (WHERE status = 'published')::int AS published,
      count(*) FILTER (WHERE status = 'draft')::int AS draft,
      count(*) FILTER (WHERE NOT is_blocked AND NOT needs_review)::int AS ready,
      count(*) FILTER (WHERE NOT is_blocked AND needs_review)::int AS needs_review,
      count(*) FILTER (WHERE is_blocked)::int AS blocked,
      count(*) FILTER (WHERE NOT ok_option_set)::int AS missing_option_set,
      count(*) FILTER (WHERE NOT ok_images)::int AS missing_images
    FROM classified`);
  const dup = await db.execute(sql`
    SELECT count(*) FILTER (WHERE is_duplicate_suspect)::int AS duplicate_suspects
    FROM product_catalogue_signals`);
  const collections = await db.execute(sql`SELECT count(*)::int AS memberships FROM collection_products`);
  return { summary, dup, collections };
}

async function main(): Promise<void> {
  if (process.env.ENABLE_SHOPIFY_SYNC === "true") {
    throw new Error("ABORT: ENABLE_SHOPIFY_SYNC must remain false.");
  }
  if (process.env.ENABLE_SHOPIFY_FULL_IMPORT !== "true") {
    throw new Error("Set ENABLE_SHOPIFY_FULL_IMPORT=true");
  }

  const databaseUrl = pgUrl();
  const reportPath = join(LOG_DIR, "FINAL-MIGRATION-REPORT.json");

  log("=== FULL SJD MIGRATION PIPELINE START ===");
  const before = await baselineStats();
  log(`baseline: ${JSON.stringify(before)}`);

  log("Phase 1: Full product import");
  const importReport = await runControlledFullImport({
    databaseUrl,
    pageSize: Number.parseInt(process.env.SHOPIFY_IMPORT_PAGE_SIZE ?? "50", 10),
    delayMs: Number.parseInt(process.env.SHOPIFY_EXTRACT_DELAY_MS ?? "500", 10),
    ...(process.env.FULL_IMPORT_RUN_ID ? { resumeRunId: process.env.FULL_IMPORT_RUN_ID } : {})
  });
  log(`import: ${importReport.message}`);
  if (!importReport.completed) {
    writeFileSync(reportPath, JSON.stringify({ ok: false, phase: "import", importReport, before }, null, 2));
    process.exitCode = 1;
    return;
  }

  log("Phase 2: Collections");
  try {
    const collections = await extractAllCollections({ databaseUrl, delayMs: 500 });
    log(`collections: ${JSON.stringify(collections)}`);
    const memberships = await syncProductCollectionMembershipsFromSourcePayload(databaseUrl);
    log(`memberships: ${JSON.stringify(memberships)}`);
  } catch (error) {
    log(`collections warning: ${error instanceof Error ? error.message : error}`);
  }

  log("Phase 3: Enrichment");
  await runTsx("packages/database/src/cli/enrich-shopify-products.ts");
  await runTsx("packages/database/src/cli/batch-classify-sport.ts");
  log(`option sets linked: ${await linkOptionSets()}`);
  await runTsx("packages/database/src/cli/refresh-seo-meta.ts");

  log("Phase 4: Signals + readiness");
  log(`signals: ${await batchComputeSignals(200)}`);
  await runTsx("packages/database/src/cli/batch-publish-readiness.ts");

  log("Phase 5: Autonomous publish");
  await runTsx("packages/database/src/cli/autonomous-publish-ready.ts");

  log("Phase 6: QA audit");
  await runTsx("packages/database/src/cli/run-catalogue-data-quality-audit.ts", ["--apply"]);

  const after = await finalStats();
  const report = { ok: true, completedAt: new Date().toISOString(), before, importReport, after, logFile: LOG_FILE };
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`=== PIPELINE COMPLETE === ${reportPath}`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  log(`FATAL: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
