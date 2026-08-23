-- Supplier portal users + PO workflow timestamps + configurable SLA thresholds

CREATE TABLE IF NOT EXISTS supplier_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers (id),
  email text NOT NULL,
  password_digest text NOT NULL,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_users_email_idx ON supplier_users (lower(email))
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS supplier_users_supplier_id_idx ON supplier_users (supplier_id);

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS supplier_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS supplier_cost_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS supplier_cost_currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS supplier_cost_notes text,
  ADD COLUMN IF NOT EXISTS supplier_cost_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz;

CREATE TABLE IF NOT EXISTS ops_sla_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_overdue_days integer NOT NULL DEFAULT 7,
  delivery_overdue_days integer NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

INSERT INTO ops_sla_settings (tracking_overdue_days, delivery_overdue_days, updated_by)
SELECT 7, 30, 'migration-0009'
WHERE NOT EXISTS (SELECT 1 FROM ops_sla_settings LIMIT 1);

CREATE TABLE IF NOT EXISTS supplier_action_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers (id),
  supplier_user_id uuid REFERENCES supplier_users (id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_action_audits_supplier_idx ON supplier_action_audits (supplier_id);
