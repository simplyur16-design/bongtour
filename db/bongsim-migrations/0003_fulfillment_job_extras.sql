BEGIN;

ALTER TABLE bongsim_fulfillment_job
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supplier_profile_ref TEXT,
  ADD COLUMN IF NOT EXISTS supplier_iccid TEXT;

COMMIT;
