-- AlterTable: seasonMessage → monthlyMessages
ALTER TABLE "AirHotelSeasonCuration" ADD COLUMN "monthlyMessages" JSONB;

UPDATE "AirHotelSeasonCuration"
SET "monthlyMessages" = '{}'::jsonb
WHERE "monthlyMessages" IS NULL;

ALTER TABLE "AirHotelSeasonCuration" ALTER COLUMN "monthlyMessages" SET NOT NULL;

ALTER TABLE "AirHotelSeasonCuration" DROP COLUMN "seasonMessage";
