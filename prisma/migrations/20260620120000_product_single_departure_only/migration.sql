-- 단일 출발 상품 — 관리자 등록 시 수동 체크 (F1·이벤트·고정 1출발)
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "singleDepartureOnly" BOOLEAN NOT NULL DEFAULT false;
