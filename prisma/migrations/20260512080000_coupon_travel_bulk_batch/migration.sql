-- 여행 고객 감사 eSIM 벌크 발급 배치·수신자 추적 (bongsim_coupon 와 FK)
CREATE TABLE IF NOT EXISTS bongsim_coupon_batch (
  batch_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_name text NOT NULL,
  departure_date date NOT NULL,
  adult_count integer NOT NULL,
  issued_by text NOT NULL,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bongsim_coupon_batch_adult_count_check CHECK (adult_count >= 1 AND adult_count <= 500)
);

CREATE INDEX IF NOT EXISTS bongsim_coupon_batch_created_at_idx ON bongsim_coupon_batch (created_at DESC);

CREATE TABLE IF NOT EXISTS bongsim_coupon_batch_item (
  item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES bongsim_coupon_batch (batch_id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_name text,
  coupon_id uuid NOT NULL REFERENCES bongsim_coupon (coupon_id) ON DELETE RESTRICT,
  email_sent_at timestamptz,
  email_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bongsim_coupon_batch_item_batch_id_idx ON bongsim_coupon_batch_item (batch_id);
