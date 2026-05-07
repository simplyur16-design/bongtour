-- D-4: 가격 freshness (lastPriceObservedAt) + 자동 비공개 메타
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lastPriceObservedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "autoUnpublishedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "autoUnpublishedReason" TEXT;

CREATE INDEX IF NOT EXISTS "Product_registrationStatus_lastPriceObservedAt_idx" ON "Product"("registrationStatus", "lastPriceObservedAt");
