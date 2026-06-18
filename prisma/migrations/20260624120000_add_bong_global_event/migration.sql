-- PR 8: BongGlobalEvent (멱등 — Supabase MCP 선적용·재배포 대비)
CREATE TABLE IF NOT EXISTS "BongGlobalEvent" (
  "id"             TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "country"        TEXT NOT NULL,
  "city"           TEXT,
  "startMonth"     INTEGER NOT NULL,
  "startDay"       INTEGER,
  "endMonth"       INTEGER NOT NULL,
  "endDay"         INTEGER,
  "type"           TEXT NOT NULL,
  "description"    TEXT,
  "appealReason"   TEXT,
  "year"           INTEGER NOT NULL,
  "source"         TEXT NOT NULL DEFAULT 'gemini',
  "collectedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BongGlobalEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BongGlobalEvent_country_idx" ON "BongGlobalEvent"("country");
CREATE INDEX IF NOT EXISTS "BongGlobalEvent_startMonth_idx" ON "BongGlobalEvent"("startMonth");
CREATE INDEX IF NOT EXISTS "BongGlobalEvent_year_idx" ON "BongGlobalEvent"("year");

CREATE UNIQUE INDEX IF NOT EXISTS "BongGlobalEvent_name_country_year_key"
  ON "BongGlobalEvent"("name", "country", "year");
