-- baseline smoke test: pipeline validation, no schema change
CREATE TABLE IF NOT EXISTS "_migration_smoke_20260624" (
  smoke_id TEXT PRIMARY KEY DEFAULT 'smoke',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO "_migration_smoke_20260624" (smoke_id) VALUES ('smoke')
  ON CONFLICT DO NOTHING;
DROP TABLE "_migration_smoke_20260624";
