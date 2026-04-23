-- Persist webhook-first payment truth on order (PostgreSQL).

BEGIN;

ALTER TABLE bongsim_order
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS paid_amount_krw BIGINT,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT;

COMMIT;
