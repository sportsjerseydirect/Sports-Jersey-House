-- Admin users + order risk scoring foundations

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text,
  password_digest text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_idx
  ON admin_users (lower(email))
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS order_risk_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  risk_score integer NOT NULL DEFAULT 0,
  risk_band text NOT NULL DEFAULT 'low',
  signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_action text,
  last_evaluated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS order_risk_scores_band_idx ON order_risk_scores (risk_band);
CREATE INDEX IF NOT EXISTS order_risk_scores_score_idx ON order_risk_scores (risk_score DESC);
