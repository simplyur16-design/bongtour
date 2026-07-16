-- ProductDeparture / ProductPrice: 동일 캘린더일 다등급(evtCd) 슬롯 키 분리 (lottetour RS002/003/004 등)

ALTER TABLE "ProductDeparture" ADD COLUMN "departureSlotKey" TEXT;

UPDATE "ProductDeparture"
SET "departureSlotKey" = COALESCE(
  NULLIF(TRIM("supplierPriceKey"), ''),
  NULLIF(TRIM("supplierDepartureCodeCandidate"), ''),
  to_char("departureDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
);

ALTER TABLE "ProductDeparture" ALTER COLUMN "departureSlotKey" SET NOT NULL;

DROP INDEX IF EXISTS "ProductDeparture_productId_departureDate_key";
CREATE UNIQUE INDEX "ProductDeparture_productId_departureSlotKey_key" ON "ProductDeparture"("productId", "departureSlotKey");
CREATE INDEX "ProductDeparture_productId_departureDate_idx" ON "ProductDeparture"("productId", "departureDate");

ALTER TABLE "ProductPrice" ADD COLUMN "priceSlotKey" TEXT;

UPDATE "ProductPrice"
SET "priceSlotKey" = to_char("date" AT TIME ZONE 'UTC', 'YYYY-MM-DD');

ALTER TABLE "ProductPrice" ALTER COLUMN "priceSlotKey" SET NOT NULL;

DROP INDEX IF EXISTS "ProductPrice_productId_date_key";
CREATE UNIQUE INDEX "ProductPrice_productId_priceSlotKey_key" ON "ProductPrice"("productId", "priceSlotKey");
CREATE INDEX "ProductPrice_productId_date_idx" ON "ProductPrice"("productId", "date");
