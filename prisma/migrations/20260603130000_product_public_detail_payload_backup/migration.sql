-- Backfill 전 publicDetailPayloadJson 스냅샷 (운영 사고 복구·감사용)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "publicDetailPayloadJsonBackup" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "publicDetailPayloadJsonBackupAt" TIMESTAMP(3);
