-- D-4: 가격 freshness (lastPriceObservedAt) + 자동 비공개 메타
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lastPriceObservedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "autoUnpublishedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "autoUnpublishedReason" TEXT;

CREATE INDEX IF NOT EXISTS "Product_registrationStatus_lastPriceObservedAt_idx" ON "Product"("registrationStatus", "lastPriceObservedAt");

-- 백필(운영 수동): ProductPrice.createdAt / ProductDeparture.createdAt 컬럼 없음.
-- 동기 시각 SSOT = ProductDeparture.syncedAt (성인가 있는 행). ProductPrice.date 는 출발일일 뿐 동기 시각 아님.
-- 예시:
-- UPDATE "Product" p
-- SET "lastPriceObservedAt" = sub.m
-- FROM (
--   SELECT "productId", MAX("syncedAt") AS m
--   FROM "ProductDeparture"
--   WHERE "adultPrice" IS NOT NULL AND "syncedAt" IS NOT NULL
--   GROUP BY "productId"
-- ) sub
-- WHERE sub."productId" = p.id
--   AND p."registrationStatus" = 'registered'
--   AND p."travelScope" = 'overseas';
