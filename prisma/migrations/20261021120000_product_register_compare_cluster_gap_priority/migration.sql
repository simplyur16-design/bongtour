-- 비교 모자란 공급사 수집분 — 등록대기 목록 우선 정렬
-- REGRESSION-FREEZE[pending-compare-gap-priority]: schema flag — manifest
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "registerCompareClusterGapPriority" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Product_registerPrePhotoQueueReady_registerCompareClusterGapPriority_updatedAt_idx"
  ON "Product" ("registerPrePhotoQueueReady", "registerCompareClusterGapPriority", "updatedAt" DESC);
