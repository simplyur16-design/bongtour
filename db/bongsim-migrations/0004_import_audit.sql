BEGIN;

CREATE TABLE IF NOT EXISTS bongsim_import_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_id TEXT NOT NULL,
  rows_upserted INT NOT NULL DEFAULT 0,
  rows_skipped INT NOT NULL DEFAULT 0,
  price_events_written INT NOT NULL DEFAULT 0,
  sheet_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bongsim_import_audit_completed_idx ON bongsim_import_audit (completed_at DESC);

COMMIT;
