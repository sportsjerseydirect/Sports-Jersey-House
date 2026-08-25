-- Product options layer (SJD Aris-compatible size + selected options).
-- Size is NOT a Shopify variant axis.

CREATE TABLE IF NOT EXISTS product_option_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  sport text,
  sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'aris-sjd',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS product_option_sets_slug_idx ON product_option_sets (slug);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS option_set_id uuid REFERENCES product_option_sets (id);

CREATE INDEX IF NOT EXISTS products_option_set_id_idx ON products (option_set_id);

ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS selected_options jsonb;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS selected_options jsonb;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS colour_label text;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS shopify_product_id text;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS shopify_variant_id text;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS storefront text NOT NULL DEFAULT 'sjh';

-- Seed confirmed Aris size option sets (exact values from SJD storefront).
INSERT INTO product_option_sets (slug, title, sport, sizes, source, created_by, updated_by)
VALUES
(
  'baseball-jerseys',
  'Baseball jerseys',
  'Baseball',
  '["XS/Men''s","S/Men''s","M/Men''s","L/Men''s","XL/Men''s","2XL/Men''s","3XL/Men''s","S/Women''s","M/Women''s","L/Women''s","XL/Women''s","Youth S","Youth M","Youth L","Youth XL","1T (1–2 yrs)","2T (2–3 yrs)","3T (3–4 yrs)","4T (4–5 yrs)","5T (5–6 yrs)","6T (6–7 yrs)"]'::jsonb,
  'aris-sjd',
  'product-options-migration',
  'product-options-migration'
),
(
  'hockey-jerseys',
  'Hockey jerseys',
  'Hockey',
  '["S/Men''s","M/Men''s","L/Men''s","XL/Men''s","2XL/Men''s","3XL/Men''s","Youth/S","Youth/M","Youth/L","Youth/XL"]'::jsonb,
  'aris-sjd',
  'product-options-migration',
  'product-options-migration'
),
(
  'soccer-jerseys',
  'Soccer jerseys',
  'Soccer',
  '["S/Men''s","M/Men''s","L/Men''s","XL/Men''s","2XL/Men''s","Youth/XS","Youth/S","Youth/M","Youth/L","Youth/XL"]'::jsonb,
  'aris-sjd',
  'product-options-migration',
  'product-options-migration'
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  sport = EXCLUDED.sport,
  sizes = EXCLUDED.sizes,
  updated_at = now(),
  updated_by = 'product-options-migration';

-- Link published products with confirmed sports to option sets.
UPDATE products p
SET
  option_set_id = os.id,
  updated_at = now(),
  updated_by = 'product-options-migration'
FROM product_option_sets os
WHERE p.deleted_at IS NULL
  AND p.option_set_id IS NULL
  AND os.deleted_at IS NULL
  AND (
    (lower(coalesce(p.sport, '')) = 'baseball' AND os.slug = 'baseball-jerseys')
    OR (lower(coalesce(p.sport, '')) = 'hockey' AND os.slug = 'hockey-jerseys')
    OR (lower(coalesce(p.sport, '')) = 'soccer' AND os.slug = 'soccer-jerseys')
  );

-- Align default customisation profile with SJD flat +4.99 when customisation is Yes.
-- Keep legacy mode prices for older flows; primary SJH path uses SJD_CUSTOMISATION_PRICE_AMOUNT.
-- Note: mode "custom" is validated in app code via selected_options; do not alter
-- customisation_mode enum in this same script (ADD VALUE + use requires separate txn).
UPDATE customisation_profiles
SET
  name_price_amount = 4.99,
  number_price_amount = 4.99,
  name_number_price_amount = 4.99,
  message_price_amount = 4.99,
  updated_at = now(),
  updated_by = 'product-options-migration'
WHERE slug = 'jersey-standard' AND deleted_at IS NULL;
