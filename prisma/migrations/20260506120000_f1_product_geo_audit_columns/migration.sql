-- F-1: geo-audit 수동 검수 이력·보류
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lastGeoAuditAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lastGeoAuditedBy" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "geoAuditSkippedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "geoAuditLastPatchJson" TEXT;
