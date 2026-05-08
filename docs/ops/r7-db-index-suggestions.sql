-- R-7-H: 인덱스 점검 보조 SQL (운영 적용 전 검토·백업 필수; idempotent 우선)
--
-- 확인 요약 (코드베이스 기준):
-- · bongsim_order.order_number — UNIQUE (db/bongsim-migrations/0001_bongsim_core.sql)
-- · bongsim_coupon_usage.order_id — UNIQUE (prisma/migrations/20260508120100_*)
-- · bongsim_coupon_batch.created_at — 인덱스 존재 (prisma/migrations/20260512080000_*)
-- · bongsim_user_coupon — user_id 단일 인덱스, (status, expires_at) 인덱스 (20260507233000)
-- · bongsim_product_option.option_api_id — PK
--
-- 아래는 워크로드에 따라 선택 적용.

-- 쿠폰함: 동일 사용자·상태 조건 동시 필터가 많을 때 (기존 user_id 단일 인덱스 보완)
CREATE INDEX IF NOT EXISTS bongsim_user_coupon_user_id_status_idx
  ON bongsim_user_coupon (user_id, status);

-- 마이페이지 주문 목록 등 buyer_email 조회가 병목일 때
CREATE INDEX IF NOT EXISTS bongsim_order_buyer_email_lower_idx
  ON bongsim_order (lower(trim(buyer_email)));

-- 로그인 연동 주문 필터: consents JSON 의 bongtour_user_id (선택·데이터 분포 확인 후)
-- CREATE INDEX IF NOT EXISTS bongsim_order_bongtour_user_id_idx
--   ON bongsim_order ((consents->>'bongtour_user_id'));

-- bongsim_coupon.code 가 이미 UNIQUE 라면 스킵. 공개 코드 조회만 대소문자 무시가 필요할 때:
-- CREATE UNIQUE INDEX IF NOT EXISTS bongsim_coupon_code_lower_uidx
--   ON bongsim_coupon (lower(trim(code)));

-- 공급사 코드 기준 목록이 병목일 때만
-- CREATE INDEX IF NOT EXISTS bongsim_product_option_vendor_code_idx
--   ON bongsim_product_option (vendor_code);
