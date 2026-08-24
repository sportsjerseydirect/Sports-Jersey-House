-- Runtime Stripe TEST webhook signing secret fallback (SJH merchant; no Connect).
-- Used when the Dashboard webhook was created on a different account/sandbox than
-- the STRIPE_SECRET_KEY that creates Checkout Sessions. Secret is never returned
-- by list APIs; only stored after webhookEndpoints.create.
CREATE TABLE IF NOT EXISTS stripe_runtime_config (
  id text PRIMARY KEY,
  webhook_endpoint_id text,
  webhook_endpoint_url text,
  webhook_signing_secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stripe_runtime_config ENABLE ROW LEVEL SECURITY;
