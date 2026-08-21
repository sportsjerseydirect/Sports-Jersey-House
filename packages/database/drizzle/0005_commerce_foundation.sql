-- Phase 1: commerce data model foundation (customisation, orders, suppliers, ops, marketing).
-- Additive only — does not replace existing catalogue/cart tables.

CREATE TYPE customisation_mode AS ENUM (
  'none',
  'name',
  'number',
  'name_number',
  'message'
);

CREATE TYPE order_status AS ENUM (
  'draft',
  'pending_payment',
  'paid',
  'processing',
  'submitted_to_supplier',
  'partially_shipped',
  'shipped',
  'delivered',
  'cancelled',
  'issue'
);

CREATE TYPE fulfilment_status AS ENUM (
  'unfulfilled',
  'awaiting_supplier',
  'submitted',
  'in_production',
  'shipped',
  'delivered',
  'cancelled'
);

CREATE TYPE purchase_order_status AS ENUM (
  'draft',
  'ready',
  'sent',
  'acknowledged',
  'fulfilled',
  'cancelled'
);

CREATE TYPE issue_reason AS ENUM (
  'wrong_item',
  'manufacturing_defect',
  'damaged_in_transit',
  'lost_shipment',
  'missing_item',
  'supplier_error',
  'customer_issue',
  'goodwill_replacement'
);

CREATE TYPE issue_status AS ENUM (
  'open',
  'investigating',
  'awaiting_customer',
  'awaiting_supplier',
  'approved',
  'rejected',
  'resolved',
  'closed'
);

CREATE TYPE lead_capture_source AS ENUM (
  'popup',
  'checkout',
  'footer',
  'abandoned_cart',
  'abandoned_checkout',
  'admin',
  'other'
);

CREATE TYPE ai_action_status AS ENUM (
  'preview',
  'pending_confirmation',
  'confirmed',
  'executed',
  'rejected',
  'failed'
);

-- ---------------------------------------------------------------------------
-- Size charts & customisation profiles
-- ---------------------------------------------------------------------------

CREATE TABLE size_charts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  sport text,
  description text,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX size_charts_slug_idx ON size_charts (slug);
CREATE INDEX size_charts_sport_idx ON size_charts (sport);

CREATE TABLE customisation_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  allowed_modes customisation_mode[] NOT NULL DEFAULT ARRAY['none', 'name', 'number', 'name_number']::customisation_mode[],
  name_max_length integer NOT NULL DEFAULT 12,
  number_max_length integer NOT NULL DEFAULT 2,
  message_max_length integer NOT NULL DEFAULT 20,
  name_price_amount numeric(12, 2) NOT NULL DEFAULT 0,
  number_price_amount numeric(12, 2) NOT NULL DEFAULT 0,
  name_number_price_amount numeric(12, 2) NOT NULL DEFAULT 0,
  message_price_amount numeric(12, 2) NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'USD',
  requires_size boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX customisation_profiles_slug_idx ON customisation_profiles (slug);
CREATE UNIQUE INDEX customisation_profiles_default_idx
  ON customisation_profiles (is_default)
  WHERE is_default = true AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Product / variant commerce fields
-- ---------------------------------------------------------------------------

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS player_name text,
  ADD COLUMN IF NOT EXISTS care_instructions text,
  ADD COLUMN IF NOT EXISTS shipping_expectations text,
  ADD COLUMN IF NOT EXISTS faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS customisation_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS size_chart_id uuid REFERENCES size_charts (id),
  ADD COLUMN IF NOT EXISTS customisation_profile_id uuid REFERENCES customisation_profiles (id);

CREATE INDEX IF NOT EXISTS products_size_chart_id_idx ON products (size_chart_id);
CREATE INDEX IF NOT EXISTS products_customisation_profile_id_idx ON products (customisation_profile_id);

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS compare_at_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS size_label text;

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  first_name text,
  last_name text,
  marketing_email_opt_in boolean NOT NULL DEFAULT false,
  marketing_sms_opt_in boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  CONSTRAINT customers_email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE UNIQUE INDEX customers_email_idx ON customers (lower(email)) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX customers_phone_idx ON customers (phone) WHERE phone IS NOT NULL;

ALTER TABLE carts
  ADD CONSTRAINT carts_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers (id);

-- ---------------------------------------------------------------------------
-- Cart line customisation (distinct customisations = distinct lines)
-- ---------------------------------------------------------------------------

ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS customisation jsonb NOT NULL DEFAULT '{"mode":"none"}'::jsonb,
  ADD COLUMN IF NOT EXISTS customisation_fingerprint text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS customisation_price_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_price_amount numeric(12, 2);

ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS cart_items_cart_id_variant_id_key;
DROP INDEX IF EXISTS cart_items_cart_variant_idx;

CREATE UNIQUE INDEX cart_items_cart_variant_customisation_idx
  ON cart_items (cart_id, variant_id, customisation_fingerprint);

-- ---------------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------------

CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  packing_slip_format text NOT NULL DEFAULT 'default_html',
  courier_notes text,
  tracking_notes text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX suppliers_code_idx ON suppliers (code) WHERE deleted_at IS NULL;

CREATE TABLE product_supplier_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products (id),
  supplier_id uuid NOT NULL REFERENCES suppliers (id),
  supplier_sku text,
  unit_cost_amount numeric(12, 2),
  currency_code text NOT NULL DEFAULT 'USD',
  is_primary boolean NOT NULL DEFAULT false,
  lead_time_days integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz,
  UNIQUE (product_id, supplier_id)
);

CREATE INDEX product_supplier_mappings_product_id_idx ON product_supplier_mappings (product_id);
CREATE INDEX product_supplier_mappings_supplier_id_idx ON product_supplier_mappings (supplier_id);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 10001;

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL DEFAULT ('SJH-' || nextval('order_number_seq')::text),
  customer_id uuid REFERENCES customers (id),
  email text,
  phone text,
  status order_status NOT NULL DEFAULT 'draft',
  fulfilment_status fulfilment_status NOT NULL DEFAULT 'unfulfilled',
  currency_code text NOT NULL DEFAULT 'USD',
  subtotal_amount numeric(12, 2) NOT NULL DEFAULT 0,
  discount_amount numeric(12, 2) NOT NULL DEFAULT 0,
  shipping_revenue_amount numeric(12, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(12, 2) NOT NULL DEFAULT 0,
  payment_fee_amount numeric(12, 2) NOT NULL DEFAULT 0,
  total_amount numeric(12, 2) NOT NULL DEFAULT 0,
  shipping_address jsonb,
  billing_address jsonb,
  customer_notes text,
  internal_notes text,
  payment_provider text,
  payment_reference text,
  cart_id uuid REFERENCES carts (id),
  placed_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX orders_order_number_idx ON orders (order_number);
CREATE INDEX orders_customer_id_idx ON orders (customer_id);
CREATE INDEX orders_status_idx ON orders (status);
CREATE INDEX orders_fulfilment_status_idx ON orders (fulfilment_status);
CREATE INDEX orders_placed_at_idx ON orders (placed_at);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id uuid REFERENCES products (id),
  variant_id uuid REFERENCES product_variants (id),
  product_title text NOT NULL,
  variant_title text NOT NULL,
  sku text,
  size_label text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  customisation jsonb NOT NULL DEFAULT '{"mode":"none"}'::jsonb,
  unit_price_amount numeric(12, 2) NOT NULL,
  customisation_price_amount numeric(12, 2) NOT NULL DEFAULT 0,
  discount_amount numeric(12, 2) NOT NULL DEFAULT 0,
  line_total_amount numeric(12, 2) NOT NULL,
  currency_code text NOT NULL DEFAULT 'USD',
  supplier_id uuid REFERENCES suppliers (id),
  purchase_order_id uuid,
  fulfilment_status fulfilment_status NOT NULL DEFAULT 'unfulfilled',
  tracking_number text,
  courier text,
  shipping_destination jsonb,
  -- Cost / margin placeholders (Phase 6 fills these in operationally)
  supplier_cost_amount numeric(12, 2),
  customisation_cost_amount numeric(12, 2),
  fulfilment_cost_amount numeric(12, 2),
  other_cost_amount numeric(12, 2),
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE INDEX order_items_order_id_idx ON order_items (order_id);
CREATE INDEX order_items_supplier_id_idx ON order_items (supplier_id);
CREATE INDEX order_items_fulfilment_status_idx ON order_items (fulfilment_status);
CREATE INDEX order_items_tracking_number_idx ON order_items (tracking_number);

-- ---------------------------------------------------------------------------
-- Purchase orders & packing slips
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS po_number_seq START 5001;

CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL DEFAULT ('PO-' || nextval('po_number_seq')::text),
  supplier_id uuid NOT NULL REFERENCES suppliers (id),
  status purchase_order_status NOT NULL DEFAULT 'draft',
  batch_date date,
  packing_slip_format text,
  packing_slip_url text,
  packing_slip_payload jsonb,
  email_to text,
  email_sent_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX purchase_orders_po_number_idx ON purchase_orders (po_number);
CREATE INDEX purchase_orders_supplier_id_idx ON purchase_orders (supplier_id);
CREATE INDEX purchase_orders_batch_date_idx ON purchase_orders (batch_date);
CREATE INDEX purchase_orders_status_idx ON purchase_orders (status);

ALTER TABLE order_items
  ADD CONSTRAINT order_items_purchase_order_id_fkey
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id);

CREATE TABLE purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders (id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES order_items (id),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  supplier_sku text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (purchase_order_id, order_item_id)
);

CREATE INDEX purchase_order_lines_po_id_idx ON purchase_order_lines (purchase_order_id);
CREATE INDEX purchase_order_lines_order_item_id_idx ON purchase_order_lines (order_item_id);

-- ---------------------------------------------------------------------------
-- Courier rules (configurable — no hard-coded permanent mappings in app code)
-- ---------------------------------------------------------------------------

CREATE TABLE courier_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pattern text NOT NULL,
  pattern_type text NOT NULL DEFAULT 'regex' CHECK (pattern_type IN ('regex', 'prefix', 'contains')),
  courier_code text NOT NULL,
  courier_name text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE INDEX courier_rules_active_priority_idx ON courier_rules (is_active, priority);

-- ---------------------------------------------------------------------------
-- Issue & replacement cases
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS issue_case_number_seq START 1001;

CREATE TABLE issue_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text NOT NULL DEFAULT ('ISS-' || nextval('issue_case_number_seq')::text),
  order_id uuid NOT NULL REFERENCES orders (id),
  order_item_id uuid REFERENCES order_items (id),
  customer_id uuid REFERENCES customers (id),
  reason issue_reason NOT NULL,
  status issue_status NOT NULL DEFAULT 'open',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  internal_notes text,
  customer_notes text,
  decision text,
  replacement_order_id uuid REFERENCES orders (id),
  replacement_cost_amount numeric(12, 2),
  supplier_responsibility boolean,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX issue_cases_case_number_idx ON issue_cases (case_number);
CREATE INDEX issue_cases_order_id_idx ON issue_cases (order_id);
CREATE INDEX issue_cases_status_idx ON issue_cases (status);

-- ---------------------------------------------------------------------------
-- Marketing capture (schema only — workflows in Phase 9)
-- ---------------------------------------------------------------------------

CREATE TABLE marketing_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  source lead_capture_source NOT NULL DEFAULT 'other',
  offer_code text,
  customer_id uuid REFERENCES customers (id),
  cart_id uuid REFERENCES carts (id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_leads_email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX marketing_leads_email_idx ON marketing_leads (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX marketing_leads_source_idx ON marketing_leads (source);

CREATE TABLE email_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  customer_id uuid REFERENCES customers (id),
  source lead_capture_source NOT NULL DEFAULT 'other',
  is_active boolean NOT NULL DEFAULT true,
  unsubscribed_at timestamptz,
  segments text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX email_subscribers_email_idx ON email_subscribers (lower(email));

CREATE TABLE abandoned_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid REFERENCES carts (id),
  customer_id uuid REFERENCES customers (id),
  email text,
  phone text,
  checkout_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  recovered_order_id uuid REFERENCES orders (id),
  abandoned_at timestamptz NOT NULL DEFAULT now(),
  recovered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX abandoned_checkouts_abandoned_at_idx ON abandoned_checkouts (abandoned_at);

-- ---------------------------------------------------------------------------
-- AI operations audit (Phase 8 foundation)
-- ---------------------------------------------------------------------------

CREATE TABLE ai_action_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  actor text NOT NULL DEFAULT 'ai_ops',
  status ai_action_status NOT NULL DEFAULT 'preview',
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview_payload jsonb,
  result_payload jsonb,
  requires_confirmation boolean NOT NULL DEFAULT true,
  confirmed_by text,
  confirmed_at timestamptz,
  executed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_action_audits_status_idx ON ai_action_audits (status);
CREATE INDEX ai_action_audits_action_type_idx ON ai_action_audits (action_type);

-- ---------------------------------------------------------------------------
-- RLS: lock down new tables (service role / server postgres bypasses RLS)
-- ---------------------------------------------------------------------------

ALTER TABLE size_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customisation_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_supplier_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE abandoned_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_action_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY size_charts_public_read ON size_charts
  FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);

CREATE POLICY customisation_profiles_public_read ON customisation_profiles
  FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL);

-- Seed default customisation profile + sport size charts (idempotent by slug)
INSERT INTO customisation_profiles (
  slug, title, description, allowed_modes,
  name_max_length, number_max_length, message_max_length,
  name_price_amount, number_price_amount, name_number_price_amount, message_price_amount,
  currency_code, requires_size, is_default
) VALUES (
  'jersey-standard',
  'Standard jersey customisation',
  'Name and/or number personalisation for made-to-order jerseys.',
  ARRAY['none', 'name', 'number', 'name_number']::customisation_mode[],
  12, 2, 20,
  15.00, 10.00, 20.00, 0.00,
  'USD', true, true
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO size_charts (slug, title, sport, description, rows, notes) VALUES
(
  'nfl-adult',
  'NFL / Football — Adult',
  'Football',
  'Chest and length guidance for adult football jerseys.',
  '[
    {"size":"S","chest_in":"34-36","length_in":"28"},
    {"size":"M","chest_in":"38-40","length_in":"29"},
    {"size":"L","chest_in":"42-44","length_in":"30"},
    {"size":"XL","chest_in":"46-48","length_in":"31"},
    {"size":"2XL","chest_in":"50-52","length_in":"32"}
  ]'::jsonb,
  'Measure chest at fullest point. Made-to-order items cannot be exchanged for size preference alone.'
),
(
  'nba-adult',
  'NBA / Basketball — Adult',
  'Basketball',
  'Chest and length guidance for adult basketball jerseys.',
  '[
    {"size":"S","chest_in":"34-36","length_in":"29"},
    {"size":"M","chest_in":"38-40","length_in":"30"},
    {"size":"L","chest_in":"42-44","length_in":"31"},
    {"size":"XL","chest_in":"46-48","length_in":"32"},
    {"size":"2XL","chest_in":"50-52","length_in":"33"}
  ]'::jsonb,
  'Made-to-order. Use the chart before ordering.'
),
(
  'nhl-adult',
  'NHL / Hockey — Adult',
  'Hockey',
  'Chest guidance for adult hockey jerseys.',
  '[
    {"size":"S","chest_in":"36-38"},
    {"size":"M","chest_in":"40-42"},
    {"size":"L","chest_in":"44-46"},
    {"size":"XL","chest_in":"48-50"},
    {"size":"2XL","chest_in":"52-54"}
  ]'::jsonb,
  'Hockey jerseys typically fit oversized; check chest measurement.'
),
(
  'mlb-adult',
  'MLB / Baseball — Adult',
  'Baseball',
  'Chest and length guidance for adult baseball jerseys.',
  '[
    {"size":"S","chest_in":"34-36","length_in":"28"},
    {"size":"M","chest_in":"38-40","length_in":"29"},
    {"size":"L","chest_in":"42-44","length_in":"30"},
    {"size":"XL","chest_in":"46-48","length_in":"31"},
    {"size":"2XL","chest_in":"50-52","length_in":"32"}
  ]'::jsonb,
  'Made-to-order. Confirm size before personalisation.'
),
(
  'soccer-adult',
  'Soccer — Adult',
  'Soccer',
  'Chest guidance for adult soccer jerseys.',
  '[
    {"size":"S","chest_in":"34-36"},
    {"size":"M","chest_in":"38-40"},
    {"size":"L","chest_in":"42-44"},
    {"size":"XL","chest_in":"46-48"},
    {"size":"2XL","chest_in":"50-52"}
  ]'::jsonb,
  'European sizing may run slightly smaller; measure carefully.'
)
ON CONFLICT (slug) DO NOTHING;

UPDATE products
SET
  customisation_enabled = true,
  care_instructions = COALESCE(
    care_instructions,
    'Machine wash cold inside out. Hang dry. Do not iron over customisation or prints.'
  ),
  shipping_expectations = COALESCE(
    shipping_expectations,
    'Made to order. Allow approximately 15–35 business days for production and delivery. Tracking is provided after dispatch and may take a few days to activate.'
  ),
  faqs = CASE
    WHEN faqs = '[]'::jsonb THEN
      '[
        {"question":"Can I customise this jersey?","answer":"Yes. Choose no customisation, name, number, or name + number on the product page."},
        {"question":"What if my size is wrong?","answer":"Items are made to order. We do not operate standard returns for change of mind. Contact support for manufacturing defects, damage, or lost shipments."},
        {"question":"When will I receive tracking?","answer":"Tracking is sent after the order ships. Couriers sometimes take a few days before the number becomes active."}
      ]'::jsonb
    ELSE faqs
  END,
  customisation_profile_id = COALESCE(
    customisation_profile_id,
    (SELECT id FROM customisation_profiles WHERE slug = 'jersey-standard' AND deleted_at IS NULL LIMIT 1)
  ),
  size_chart_id = COALESCE(
    size_chart_id,
    (
      SELECT sc.id
      FROM size_charts sc
      WHERE sc.deleted_at IS NULL
        AND (
          (lower(products.sport) = 'football' AND sc.slug = 'nfl-adult')
          OR (lower(products.sport) = 'basketball' AND sc.slug = 'nba-adult')
          OR (lower(products.sport) = 'hockey' AND sc.slug = 'nhl-adult')
          OR (lower(products.sport) = 'baseball' AND sc.slug = 'mlb-adult')
          OR (lower(products.sport) = 'soccer' AND sc.slug = 'soccer-adult')
        )
      LIMIT 1
    )
  ),
  updated_at = now()
WHERE deleted_at IS NULL;
