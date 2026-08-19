CREATE TABLE carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  currency_code text NOT NULL DEFAULT 'USD',
  customer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX carts_session_id_idx ON carts (session_id);

CREATE TABLE cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products (id),
  variant_id uuid NOT NULL REFERENCES product_variants (id),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, variant_id)
);

CREATE INDEX cart_items_cart_id_idx ON cart_items (cart_id);
CREATE INDEX cart_items_variant_id_idx ON cart_items (variant_id);

ALTER TABLE collections ADD COLUMN IF NOT EXISTS source_payload jsonb;
