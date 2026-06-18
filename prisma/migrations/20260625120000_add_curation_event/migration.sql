-- PR (가)-2: CurationEvent + MonthlyCurationContent.showEventTagsOnPublic (멱등 — Supabase MCP 선적용·재배포 대비)
CREATE TABLE IF NOT EXISTS "CurationEvent" (
  "id"                       TEXT NOT NULL,
  "monthKey"                 TEXT NOT NULL,
  "countryCode"              TEXT NOT NULL,
  "countryKey"               TEXT,
  "name"                     TEXT NOT NULL,
  "city"                     TEXT,
  "startMonth"               INTEGER NOT NULL,
  "startDay"                 INTEGER,
  "endMonth"                 INTEGER NOT NULL,
  "endDay"                   INTEGER,
  "type"                     TEXT NOT NULL,
  "description"              TEXT,
  "appealReason"             TEXT,
  "monthlyCurationContentId" TEXT,
  "year"                     INTEGER NOT NULL,
  "source"                   TEXT NOT NULL DEFAULT 'gemini',
  "status"                   TEXT NOT NULL DEFAULT 'draft',
  "marketingOnly"            BOOLEAN NOT NULL DEFAULT true,
  "collectedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CurationEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MonthlyCurationContent"
  ADD COLUMN IF NOT EXISTS "showEventTagsOnPublic" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "CurationEvent_name_countryCode_year_key"
  ON "CurationEvent"("name", "countryCode", "year");

CREATE INDEX IF NOT EXISTS "CurationEvent_monthKey_countryCode_idx"
  ON "CurationEvent"("monthKey", "countryCode");

CREATE INDEX IF NOT EXISTS "CurationEvent_countryCode_startMonth_idx"
  ON "CurationEvent"("countryCode", "startMonth");

CREATE INDEX IF NOT EXISTS "CurationEvent_monthlyCurationContentId_idx"
  ON "CurationEvent"("monthlyCurationContentId");

CREATE INDEX IF NOT EXISTS "CurationEvent_status_marketingOnly_idx"
  ON "CurationEvent"("status", "marketingOnly");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CurationEvent_monthlyCurationContentId_fkey'
  ) THEN
    ALTER TABLE "CurationEvent"
      ADD CONSTRAINT "CurationEvent_monthlyCurationContentId_fkey"
      FOREIGN KEY ("monthlyCurationContentId")
      REFERENCES "MonthlyCurationContent"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
