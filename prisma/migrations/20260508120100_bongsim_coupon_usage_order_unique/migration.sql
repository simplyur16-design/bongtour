-- 4차-A: 주문당 쿠폰 사용 1건 — order_id UNIQUE (이미 존재하면 스킵)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bongsim_coupon_usage_order_id_unique'
  ) THEN
    ALTER TABLE bongsim_coupon_usage
      ADD CONSTRAINT bongsim_coupon_usage_order_id_unique UNIQUE (order_id);
  END IF;
END $$;
