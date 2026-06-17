-- Tier 2 ①: calendar batch 운영 메타 → Product 정식 컬럼 + regex 백필 (c85107a SSOT)

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "calendarBatchCursorYmd" TEXT,
  ADD COLUMN IF NOT EXISTS "calendarBatchRetired" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Product" p
SET
  "calendarBatchCursorYmd" = CASE
    WHEN p."rawMeta" IS NULL OR btrim(p."rawMeta") = '' THEN NULL
    ELSE NULLIF(
      substring(p."rawMeta" FROM '"calendarBatchCursorYmd"\s*:\s*"(\d{4}-\d{2}-\d{2})"'),
      ''
    )
  END,
  "calendarBatchRetired" = CASE
    WHEN p."rawMeta" IS NULL OR btrim(p."rawMeta") = '' THEN false
    WHEN p."rawMeta" ~ '"calendarBatchRetired"\s*:\s*true(\s*[,}]|$)' THEN true
    WHEN p."rawMeta" ~ '"calendarBatchRetired"\s*:\s*"true"' THEN true
    WHEN p."rawMeta" ~ '"calendarBatchRetired"\s*:\s*1(\s*[,}]|$)' THEN true
    WHEN p."rawMeta" ~ '"calendarBatchRetired"\s*:\s*"1"' THEN true
    ELSE false
  END
WHERE p."rawMeta" IS NOT NULL;

UPDATE "Product"
SET "calendarBatchCursorYmd" = NULL, "calendarBatchRetired" = false
WHERE id = 'cmqdhspox005q11sj3sq4neqg';

CREATE INDEX IF NOT EXISTS "Product_calendarBatchRetired_updatedAt_idx"
  ON "Product" ("calendarBatchRetired", "updatedAt");
