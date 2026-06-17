-- PR 2.5: BongCardNewsSeries — 출발 기간 → 박/일 + 시즌
ALTER TABLE "BongCardNewsSeries" DROP COLUMN IF EXISTS "targetDepartureFrom";
ALTER TABLE "BongCardNewsSeries" DROP COLUMN IF EXISTS "targetDepartureTo";
ALTER TABLE "BongCardNewsSeries" ADD COLUMN IF NOT EXISTS "tripNights" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BongCardNewsSeries" ADD COLUMN IF NOT EXISTS "tripDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BongCardNewsSeries" ADD COLUMN IF NOT EXISTS "season" TEXT;
