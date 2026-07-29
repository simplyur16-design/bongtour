-- eSIM 결제: 알림톡·검색용 수신 휴대폰 (앱 코드는 buyer_tel 사용)
-- 운영 DB에 이미 컬럼이 있어도 IF NOT EXISTS 로 안전.

BEGIN;

ALTER TABLE bongsim_order
  ADD COLUMN IF NOT EXISTS buyer_tel TEXT;

COMMIT;
