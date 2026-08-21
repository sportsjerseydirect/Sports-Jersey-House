-- Simplified AI catalogue agent: learning → autonomous per change category.

CREATE TABLE IF NOT EXISTS ai_agent_settings (
  id text PRIMARY KEY DEFAULT 'default',
  autonomous_enabled boolean NOT NULL DEFAULT true,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

INSERT INTO ai_agent_settings (id, autonomous_enabled, notes, updated_by)
VALUES (
  'default',
  true,
  'Global kill-switch for autonomous catalogue changes. Learning mode still collects approvals.',
  'migration-0008'
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS ai_agent_category_modes (
  category text PRIMARY KEY,
  mode text NOT NULL DEFAULT 'learning'
    CHECK (mode IN ('learning', 'autonomous')),
  consecutive_approvals integer NOT NULL DEFAULT 0,
  approval_threshold integer NOT NULL DEFAULT 3,
  always_require_approval boolean NOT NULL DEFAULT false,
  label text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

INSERT INTO ai_agent_category_modes (category, mode, consecutive_approvals, approval_threshold, always_require_approval, label, updated_by)
VALUES
  ('taxonomy', 'learning', 0, 3, false, 'Taxonomy (sport/league/team/player/type)', 'migration-0008'),
  ('collections', 'learning', 0, 3, false, 'Collection assignment', 'migration-0008'),
  ('descriptions', 'learning', 0, 3, false, 'Description improvements', 'migration-0008'),
  ('seo', 'learning', 0, 3, false, 'SEO metadata / schema / alt text', 'migration-0008'),
  ('tags', 'learning', 0, 3, false, 'Tags / search attributes', 'migration-0008'),
  ('retirement', 'learning', 0, 3, true, 'Retire / archive proposals (never hard-delete)', 'migration-0008'),
  ('new_listing', 'learning', 0, 3, true, 'CREATE_NEW_LISTING opportunities', 'migration-0008')
ON CONFLICT (category) DO NOTHING;

CREATE TABLE IF NOT EXISTS ai_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL REFERENCES ai_agent_category_modes(category),
  product_id uuid REFERENCES products(id),
  field_name text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  reason text NOT NULL,
  confidence numeric(5,2),
  decision text NOT NULL DEFAULT 'pending'
    CHECK (decision IN ('pending', 'approved', 'rejected', 'auto_applied', 'cancelled')),
  decided_by text,
  decided_at timestamptz,
  applied_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_change_log_category_decision_idx
  ON ai_change_log (category, decision, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_change_log_product_idx
  ON ai_change_log (product_id);

-- Lightweight GSC observation store (foundation only; no live GSC sync yet).
CREATE TABLE IF NOT EXISTS gsc_page_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path text NOT NULL,
  product_id uuid REFERENCES products(id),
  impressions integer,
  clicks integer,
  ctr numeric(8,6),
  average_position numeric(8,2),
  issue_codes text[] NOT NULL DEFAULT '{}',
  notes text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_path, observed_at)
);

CREATE INDEX IF NOT EXISTS gsc_page_insights_product_idx ON gsc_page_insights (product_id);
