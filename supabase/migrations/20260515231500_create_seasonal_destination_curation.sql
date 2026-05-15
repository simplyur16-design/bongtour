CREATE TABLE "SeasonalDestinationCuration" (
  id text PRIMARY KEY,
  "cycleStartDate" timestamp NOT NULL UNIQUE,
  "cycleEndDate" timestamp NOT NULL,
  "cityKeys" text[] NOT NULL DEFAULT '{}',
  "fallbackKeys" text[] NOT NULL DEFAULT '{}',
  "geminiPrompt" text NULL,
  "geminiResponse" jsonb NULL,
  notes text NULL,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SeasonalDestinationCuration_cycleStartDate_idx" ON "SeasonalDestinationCuration"("cycleStartDate");
CREATE INDEX "SeasonalDestinationCuration_cycleEndDate_idx" ON "SeasonalDestinationCuration"("cycleEndDate");
