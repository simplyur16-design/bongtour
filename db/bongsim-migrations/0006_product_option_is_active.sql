-- 상품 노출 토글 (관리자 eSIM 상품 관리)
BEGIN;
ALTER TABLE bongsim_product_option
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
COMMIT;
