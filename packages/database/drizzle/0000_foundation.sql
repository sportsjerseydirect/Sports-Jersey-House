CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE product_status AS ENUM ('draft', 'review', 'published', 'archived');
CREATE TYPE approval_status AS ENUM ('draft', 'ai_generated', 'under_review', 'approved', 'rejected', 'published', 'archived');
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE market AS ENUM ('US', 'CA');

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_id text,
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  vendor text,
  product_type text,
  sport text,
  league text,
  team text,
  status product_status NOT NULL DEFAULT 'draft',
  source_payload jsonb,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(vendor, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(sport, '') || ' ' || coalesce(league, '') || ' ' || coalesce(team, '')), 'A')
  ) STORED,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX products_slug_idx ON products (slug);
CREATE UNIQUE INDEX products_shopify_id_idx ON products (shopify_id) WHERE shopify_id IS NOT NULL;
CREATE INDEX products_status_idx ON products (status);
CREATE INDEX products_search_vector_idx ON products USING gin (search_vector);
CREATE INDEX products_embedding_idx ON products USING hnsw (embedding vector_cosine_ops);

CREATE TABLE product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products (id),
  shopify_id text,
  sku text,
  title text NOT NULL,
  price_amount numeric(12, 2) NOT NULL,
  currency_code text NOT NULL DEFAULT 'USD',
  inventory_quantity integer,
  is_available boolean NOT NULL DEFAULT false,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE INDEX product_variants_product_id_idx ON product_variants (product_id);
CREATE INDEX product_variants_sku_idx ON product_variants (sku);
CREATE UNIQUE INDEX product_variants_shopify_id_idx ON product_variants (shopify_id) WHERE shopify_id IS NOT NULL;

CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products (id),
  url text NOT NULL,
  alt_text text,
  width integer,
  height integer,
  sort_order integer NOT NULL DEFAULT 0,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE INDEX product_images_product_id_idx ON product_images (product_id);

CREATE TABLE collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_id text,
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  status product_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX collections_slug_idx ON collections (slug);
CREATE UNIQUE INDEX collections_shopify_id_idx ON collections (shopify_id) WHERE shopify_id IS NOT NULL;

CREATE TABLE collection_products (
  collection_id uuid NOT NULL REFERENCES collections (id),
  product_id uuid NOT NULL REFERENCES products (id),
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, product_id)
);

CREATE INDEX collection_products_collection_id_idx ON collection_products (collection_id);
CREATE INDEX collection_products_product_id_idx ON collection_products (product_id);

CREATE TABLE seo_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  title text,
  meta_description text,
  canonical_path text,
  structured_data jsonb,
  ai_title text,
  ai_meta_description text,
  approval_status approval_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX seo_records_target_idx ON seo_records (target_type, target_id);

CREATE TABLE compliance_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  risk_level risk_level NOT NULL,
  reason text NOT NULL,
  recommendation text,
  approval_status approval_status NOT NULL DEFAULT 'under_review',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE INDEX compliance_flags_target_idx ON compliance_flags (target_type, target_id);

CREATE TABLE creative_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type text NOT NULL,
  campaign text,
  page text,
  product_id uuid,
  collection_id uuid,
  brief text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  format text NOT NULL,
  status approval_status NOT NULL DEFAULT 'draft',
  compliance_status approval_status NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  provenance text NOT NULL,
  alt_text text NOT NULL,
  url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE INDEX creative_assets_status_idx ON creative_assets (status);

CREATE TABLE migration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'shopify',
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  last_checkpoint jsonb,
  counters jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE migration_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES migration_runs (id),
  resource text NOT NULL,
  cursor text,
  completed boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, resource)
);
