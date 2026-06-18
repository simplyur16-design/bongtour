CREATE TABLE "BongGlobalEvent" (
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

CREATE INDEX "BongGlobalEvent_country_idx" ON "BongGlobalEvent"("country");
CREATE INDEX "BongGlobalEvent_startMonth_idx" ON "BongGlobalEvent"("startMonth");
CREATE INDEX "BongGlobalEvent_year_idx" ON "BongGlobalEvent"("year");

CREATE UNIQUE INDEX "BongGlobalEvent_name_country_year_key"
  ON "BongGlobalEvent"("name", "country", "year");
