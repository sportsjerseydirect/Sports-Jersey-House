-- Migration 0006: ops hardening, catalogue intelligence, import staging, jobs
-- Additive only. Does not publish or delete catalogue products.

-- ---------------------------------------------------------------------------
-- Tracking exceptions (persisted queue)
-- ---------------------------------------------------------------------------
CREATE TYPE tracking_exception_status AS ENUM (
  'open',
  'resolved',
  'ignored'
);

CREATE TABLE tracking_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_line text NOT NULL,
  tracking_number text,
  order_number text,
  order_item_id uuid REFERENCES order_items (id),
  courier_guess text,
  reason text NOT NULL,
  status tracking_exception_status NOT NULL DEFAULT 'open',
  ingest_batch_id uuid,
  resolved_at timestamptz,
  resolved_by text,
  resolution_notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE INDEX tracking_exceptions_status_idx ON tracking_exceptions (status);
CREATE INDEX tracking_exceptions_created_at_idx ON tracking_exceptions (created_at DESC);

-- ---------------------------------------------------------------------------
-- Issue evidence media
-- ---------------------------------------------------------------------------
CREATE TABLE issue_case_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_case_id uuid NOT NULL REFERENCES issue_cases (id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'url', 'image', 'file')),
  label text,
  url text,
  storage_key text,
  mime_type text,
  byte_size integer,
  notes text,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX issue_case_evidence_case_idx ON issue_case_evidence (issue_case_id);

CREATE TABLE issue_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_case_id uuid NOT NULL REFERENCES issue_cases (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor text NOT NULL DEFAULT 'system',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX issue_case_events_case_idx ON issue_case_events (issue_case_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Marketing offers (WELCOME10 eligibility — no campaign send)
-- ---------------------------------------------------------------------------
CREATE TABLE marketing_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  title text NOT NULL,
  description text,
  percent_off numeric(5, 2),
  amount_off numeric(12, 2),
  currency_code text NOT NULL DEFAULT 'USD',
  is_active boolean NOT NULL DEFAULT true,
  requires_lead_capture boolean NOT NULL DEFAULT true,
  first_order_only boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX marketing_offers_code_idx ON marketing_offers (code) WHERE deleted_at IS NULL;

INSERT INTO marketing_offers (code, title, description, percent_off, requires_lead_capture, first_order_only)
SELECT
  'WELCOME10',
  'First visit 10% off',
  '10% off first order after lead capture. Campaign automation disabled.',
  10.00,
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM marketing_offers WHERE code = 'WELCOME10' AND deleted_at IS NULL
);

-- ---------------------------------------------------------------------------
-- Operational job runs (idempotent / auditable)
-- ---------------------------------------------------------------------------
CREATE TYPE ops_job_status AS ENUM (
  'queued',
  'running',
  'succeeded',
  'failed',
  'skipped'
);

CREATE TABLE ops_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  idempotency_key text NOT NULL,
  status ops_job_status NOT NULL DEFAULT 'queued',
  dry_run boolean NOT NULL DEFAULT true,
  allow_external_send boolean NOT NULL DEFAULT false,
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_payload jsonb,
  error_message text,
  attempt_count integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ops_job_runs_idempotency_idx ON ops_job_runs (idempotency_key);
CREATE INDEX ops_job_runs_type_status_idx ON ops_job_runs (job_type, status);

-- ---------------------------------------------------------------------------
-- Catalogue intelligence
-- ---------------------------------------------------------------------------
CREATE TYPE catalogue_recommendation AS ENUM (
  'KEEP',
  'UPDATE',
  'REVIEW',
  'RETIRE',
  'DUPLICATE',
  'CREATE_NEW_LISTING'
);

CREATE TYPE catalogue_proposal_status AS ENUM (
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'applied',
  'cancelled'
);

CREATE TABLE product_catalogue_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products (id),
  quality_score numeric(5, 2),
  health_status text NOT NULL DEFAULT 'unknown',
  lifecycle_label text,
  is_outdated boolean NOT NULL DEFAULT false,
  is_duplicate_suspect boolean NOT NULL DEFAULT false,
  missing_opportunity boolean NOT NULL DEFAULT false,
  margin_flag text,
  content_flag text,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_catalogue_signals_product_idx ON product_catalogue_signals (product_id);
CREATE INDEX product_catalogue_signals_health_idx ON product_catalogue_signals (health_status);

CREATE SEQUENCE IF NOT EXISTS catalogue_proposal_number_seq START 1001;

CREATE TABLE catalogue_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_number text NOT NULL DEFAULT ('CAT-' || nextval('catalogue_proposal_number_seq')::text),
  recommendation catalogue_recommendation NOT NULL,
  status catalogue_proposal_status NOT NULL DEFAULT 'pending_review',
  product_id uuid REFERENCES products (id),
  title text NOT NULL,
  rationale text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  proposed_changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_risk_level text NOT NULL DEFAULT 'low',
  ip_notes text,
  created_by text NOT NULL DEFAULT 'catalogue_agent',
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX catalogue_proposals_number_idx ON catalogue_proposals (proposal_number);
CREATE INDEX catalogue_proposals_status_idx ON catalogue_proposals (status);
CREATE INDEX catalogue_proposals_recommendation_idx ON catalogue_proposals (recommendation);

CREATE TABLE catalogue_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES catalogue_proposals (id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 100,
  queue_status text NOT NULL DEFAULT 'open',
  assigned_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX catalogue_review_queue_status_idx ON catalogue_review_queue (queue_status, priority);

-- IP/compliance as publishing risk layer (NOT search blocking)
CREATE TABLE content_ip_risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products (id),
  proposal_id uuid REFERENCES catalogue_proposals (id),
  term text NOT NULL,
  context text,
  risk_level text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX content_ip_risk_flags_product_idx ON content_ip_risk_flags (product_id);
CREATE INDEX content_ip_risk_flags_status_idx ON content_ip_risk_flags (status);

-- ---------------------------------------------------------------------------
-- Shopify import staging (read-only extract → stage; no SJD writes)
-- ---------------------------------------------------------------------------
CREATE TYPE shopify_import_run_status AS ENUM (
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled'
);

CREATE TABLE shopify_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL DEFAULT 'dry_run' CHECK (mode IN ('dry_run', 'sample', 'incremental', 'full')),
  status shopify_import_run_status NOT NULL DEFAULT 'pending',
  sample_limit integer,
  cursor text,
  products_fetched integer NOT NULL DEFAULT 0,
  products_staged integer NOT NULL DEFAULT 0,
  errors_count integer NOT NULL DEFAULT 0,
  dry_run boolean NOT NULL DEFAULT true,
  sync_gate_enabled boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shopify_import_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES shopify_import_runs (id) ON DELETE CASCADE,
  shopify_product_id text NOT NULL,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, shopify_product_id)
);

CREATE INDEX shopify_import_raw_run_idx ON shopify_import_raw (run_id);

CREATE TABLE shopify_import_staged_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES shopify_import_runs (id) ON DELETE CASCADE,
  shopify_product_id text NOT NULL,
  title text,
  handle text,
  status text,
  vendor text,
  product_type text,
  normalized jsonb NOT NULL DEFAULT '{}'::jsonb,
  duplicate_of_product_id uuid REFERENCES products (id),
  duplicate_score numeric(5, 2),
  import_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, shopify_product_id)
);

CREATE INDEX shopify_import_staged_run_idx ON shopify_import_staged_products (run_id);

CREATE TABLE shopify_import_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES shopify_import_runs (id) ON DELETE CASCADE,
  shopify_product_id text,
  stage text NOT NULL,
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shopify_import_errors_run_idx ON shopify_import_errors (run_id);

-- ---------------------------------------------------------------------------
-- RLS lockdown for new tables
-- ---------------------------------------------------------------------------
ALTER TABLE tracking_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_case_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_catalogue_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_ip_risk_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_import_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_import_staged_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_import_errors ENABLE ROW LEVEL SECURITY;
