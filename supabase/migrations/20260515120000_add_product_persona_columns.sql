ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "personaLabels" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "personaScore" jsonb NULL,
  ADD COLUMN IF NOT EXISTS "personaUpdatedAt" timestamp NULL;

COMMENT ON COLUMN "Product"."personaLabels" IS '페르소나 라벨 배열 (최대 2개): with-parents / with-kids / couple';
COMMENT ON COLUMN "Product"."personaScore" IS '페르소나 점수 JSONB: {"with-parents":int,"with-kids":int,"couple":int}';
COMMENT ON COLUMN "Product"."personaUpdatedAt" IS '페르소나 분류 마지막 실행 시점';
