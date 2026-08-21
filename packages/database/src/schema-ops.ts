import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { products } from "./schema-catalogue";
import { issueCases, orderItems } from "./schema-commerce";

export const trackingExceptionStatus = pgEnum("tracking_exception_status", [
  "open",
  "resolved",
  "ignored"
]);

export const opsJobStatus = pgEnum("ops_job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "skipped"
]);

export const catalogueRecommendation = pgEnum("catalogue_recommendation", [
  "KEEP",
  "UPDATE",
  "REVIEW",
  "RETIRE",
  "DUPLICATE",
  "CREATE_NEW_LISTING"
]);

export const catalogueProposalStatus = pgEnum("catalogue_proposal_status", [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "applied",
  "cancelled"
]);

export const shopifyImportRunStatus = pgEnum("shopify_import_run_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled"
]);

export const trackingExceptions = pgTable(
  "tracking_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rawLine: text("raw_line").notNull(),
    trackingNumber: text("tracking_number"),
    orderNumber: text("order_number"),
    orderItemId: uuid("order_item_id").references(() => orderItems.id),
    courierGuess: text("courier_guess"),
    reason: text("reason").notNull(),
    status: trackingExceptionStatus("status").notNull().default("open"),
    ingestBatchId: uuid("ingest_batch_id"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by"),
    resolutionNotes: text("resolution_notes"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    statusIdx: index("tracking_exceptions_status_idx").on(table.status),
    createdAtIdx: index("tracking_exceptions_created_at_idx").on(table.createdAt)
  })
);

export const issueCaseEvidence = pgTable(
  "issue_case_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueCaseId: uuid("issue_case_id")
      .notNull()
      .references(() => issueCases.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("note"),
    label: text("label"),
    url: text("url"),
    storageKey: text("storage_key"),
    mimeType: text("mime_type"),
    byteSize: integer("byte_size"),
    notes: text("notes"),
    uploadedBy: text("uploaded_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    caseIdx: index("issue_case_evidence_case_idx").on(table.issueCaseId)
  })
);

export const issueCaseEvents = pgTable(
  "issue_case_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueCaseId: uuid("issue_case_id")
      .notNull()
      .references(() => issueCases.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    actor: text("actor").notNull().default("system"),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    caseIdx: index("issue_case_events_case_idx").on(table.issueCaseId)
  })
);

export const marketingOffers = pgTable(
  "marketing_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    percentOff: numeric("percent_off", { precision: 5, scale: 2 }),
    amountOff: numeric("amount_off", { precision: 12, scale: 2 }),
    currencyCode: text("currency_code").notNull().default("USD"),
    isActive: boolean("is_active").notNull().default(true),
    requiresLeadCapture: boolean("requires_lead_capture").notNull().default(true),
    firstOrderOnly: boolean("first_order_only").notNull().default(true),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    codeIdx: uniqueIndex("marketing_offers_code_idx").on(table.code)
  })
);

export const opsJobRuns = pgTable(
  "ops_job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobType: text("job_type").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: opsJobStatus("status").notNull().default("queued"),
    dryRun: boolean("dry_run").notNull().default(true),
    allowExternalSend: boolean("allow_external_send").notNull().default(false),
    inputPayload: jsonb("input_payload").notNull().default(sql`'{}'::jsonb`),
    resultPayload: jsonb("result_payload"),
    errorMessage: text("error_message"),
    attemptCount: integer("attempt_count").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    idempotencyIdx: uniqueIndex("ops_job_runs_idempotency_idx").on(table.idempotencyKey),
    typeStatusIdx: index("ops_job_runs_type_status_idx").on(table.jobType, table.status)
  })
);

export const productCatalogueSignals = pgTable(
  "product_catalogue_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").references(() => products.id),
    qualityScore: numeric("quality_score", { precision: 5, scale: 2 }),
    healthStatus: text("health_status").notNull().default("unknown"),
    lifecycleLabel: text("lifecycle_label"),
    isOutdated: boolean("is_outdated").notNull().default(false),
    isDuplicateSuspect: boolean("is_duplicate_suspect").notNull().default(false),
    missingOpportunity: boolean("missing_opportunity").notNull().default(false),
    marginFlag: text("margin_flag"),
    contentFlag: text("content_flag"),
    signals: jsonb("signals").notNull().default(sql`'{}'::jsonb`),
    evidence: jsonb("evidence").notNull().default(sql`'[]'::jsonb`),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    productIdx: index("product_catalogue_signals_product_idx").on(table.productId),
    healthIdx: index("product_catalogue_signals_health_idx").on(table.healthStatus)
  })
);

export const catalogueProposals = pgTable(
  "catalogue_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalNumber: text("proposal_number")
      .notNull()
      .default(sql`'CAT-' || nextval('catalogue_proposal_number_seq')`),
    recommendation: catalogueRecommendation("recommendation").notNull(),
    status: catalogueProposalStatus("status").notNull().default("pending_review"),
    productId: uuid("product_id").references(() => products.id),
    title: text("title").notNull(),
    rationale: text("rationale").notNull(),
    evidence: jsonb("evidence").notNull().default(sql`'[]'::jsonb`),
    proposedChanges: jsonb("proposed_changes").notNull().default(sql`'{}'::jsonb`),
    ipRiskLevel: text("ip_risk_level").notNull().default("low"),
    ipNotes: text("ip_notes"),
    createdBy: text("created_by").notNull().default("catalogue_agent"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    numberIdx: uniqueIndex("catalogue_proposals_number_idx").on(table.proposalNumber),
    statusIdx: index("catalogue_proposals_status_idx").on(table.status),
    recommendationIdx: index("catalogue_proposals_recommendation_idx").on(table.recommendation)
  })
);

export const catalogueReviewQueue = pgTable(
  "catalogue_review_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => catalogueProposals.id, { onDelete: "cascade" }),
    priority: integer("priority").notNull().default(100),
    queueStatus: text("queue_status").notNull().default("open"),
    assignedTo: text("assigned_to"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    statusIdx: index("catalogue_review_queue_status_idx").on(table.queueStatus, table.priority)
  })
);

export const contentIpRiskFlags = pgTable(
  "content_ip_risk_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").references(() => products.id),
    proposalId: uuid("proposal_id").references(() => catalogueProposals.id),
    term: text("term").notNull(),
    context: text("context"),
    riskLevel: text("risk_level").notNull().default("medium"),
    status: text("status").notNull().default("open"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    productIdx: index("content_ip_risk_flags_product_idx").on(table.productId),
    statusIdx: index("content_ip_risk_flags_status_idx").on(table.status)
  })
);

export const shopifyImportRuns = pgTable(
  "shopify_import_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mode: text("mode").notNull().default("dry_run"),
    status: shopifyImportRunStatus("status").notNull().default("pending"),
    sampleLimit: integer("sample_limit"),
    cursor: text("cursor"),
    productsFetched: integer("products_fetched").notNull().default(0),
    productsStaged: integer("products_staged").notNull().default(0),
    errorsCount: integer("errors_count").notNull().default(0),
    dryRun: boolean("dry_run").notNull().default(true),
    syncGateEnabled: boolean("sync_gate_enabled").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  }
);

export const shopifyImportRaw = pgTable(
  "shopify_import_raw",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => shopifyImportRuns.id, { onDelete: "cascade" }),
    shopifyProductId: text("shopify_product_id").notNull(),
    payload: jsonb("payload").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    runProductIdx: uniqueIndex("shopify_import_raw_run_product_idx").on(
      table.runId,
      table.shopifyProductId
    ),
    runIdx: index("shopify_import_raw_run_idx").on(table.runId)
  })
);

export const shopifyImportStagedProducts = pgTable(
  "shopify_import_staged_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => shopifyImportRuns.id, { onDelete: "cascade" }),
    shopifyProductId: text("shopify_product_id").notNull(),
    title: text("title"),
    handle: text("handle"),
    status: text("status"),
    vendor: text("vendor"),
    productType: text("product_type"),
    normalized: jsonb("normalized").notNull().default(sql`'{}'::jsonb`),
    /** SOURCE_MATCH | POSSIBLE_DUPLICATE | null */
    matchKind: text("match_kind"),
    duplicateOfProductId: uuid("duplicate_of_product_id").references(() => products.id),
    duplicateScore: numeric("duplicate_score", { precision: 5, scale: 2 }),
    importError: text("import_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    runProductIdx: uniqueIndex("shopify_import_staged_run_product_idx").on(
      table.runId,
      table.shopifyProductId
    ),
    runIdx: index("shopify_import_staged_run_idx").on(table.runId)
  })
);

export const shopifyImportErrors = pgTable(
  "shopify_import_errors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => shopifyImportRuns.id, { onDelete: "cascade" }),
    shopifyProductId: text("shopify_product_id"),
    stage: text("stage").notNull(),
    message: text("message").notNull(),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    retryCount: integer("retry_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    runIdx: index("shopify_import_errors_run_idx").on(table.runId)
  })
);

export const catalogueProposalsRelations = relations(catalogueProposals, ({ one, many }) => ({
  product: one(products, { fields: [catalogueProposals.productId], references: [products.id] }),
  queueItems: many(catalogueReviewQueue)
}));
