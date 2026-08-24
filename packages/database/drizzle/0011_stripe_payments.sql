-- Stripe TEST-MODE payment tracking (SJH merchant; no Connect).
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_checkout_session_id_uidx
  ON orders (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_payment_intent_id_uidx
  ON orders (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_payment_reference_idx
  ON orders (payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  livemode boolean NOT NULL DEFAULT false,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  order_id uuid REFERENCES orders (id),
  processing_status text NOT NULL DEFAULT 'processed',
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_by text,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_order_id_idx
  ON stripe_webhook_events (order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS stripe_webhook_events_session_id_idx
  ON stripe_webhook_events (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
