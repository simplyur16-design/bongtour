-- eSIM 결제: 알림톡·PG 모바일 결제용 수신 휴대폰
ALTER TABLE bongsim_order
  ADD COLUMN IF NOT EXISTS buyer_phone TEXT;
