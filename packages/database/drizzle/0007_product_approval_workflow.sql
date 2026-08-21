-- Product lifecycle: add approved status between review and published.
-- Also distinguish Shopify source rematch from commercial duplicate on staged imports.

ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'approved' AFTER 'review';

ALTER TABLE shopify_import_staged_products
  ADD COLUMN IF NOT EXISTS match_kind text;

COMMENT ON COLUMN shopify_import_staged_products.match_kind IS
  'SOURCE_MATCH = same Shopify product id already in SJH; POSSIBLE_DUPLICATE = slug/title commercial overlap; null = new';

COMMENT ON COLUMN shopify_import_staged_products.duplicate_of_product_id IS
  'Set only for POSSIBLE_DUPLICATE matches — not for SOURCE_MATCH rematches of the same Shopify product.';
