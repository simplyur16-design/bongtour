-- 봉심 core schema (PostgreSQL)
-- Apply with your migration runner or `psql -f`.

BEGIN;

CREATE TABLE IF NOT EXISTS bongsim_product_option (
  option_api_id TEXT PRIMARY KEY,
  vendor_code TEXT NOT NULL,
  sim_kind TEXT NOT NULL,
  excel_update_type TEXT,
  excel_sheet TEXT NOT NULL,
  excel_sheet_language TEXT NOT NULL DEFAULT 'ko',
  plan_line_excel TEXT NOT NULL,
  network_family TEXT NOT NULL,
  plan_type TEXT,
  plan_name TEXT NOT NULL,
  days_raw TEXT NOT NULL,
  allowance_label TEXT NOT NULL,
  option_label TEXT NOT NULL,
  carrier_raw TEXT,
  data_class_raw TEXT,
  network_raw TEXT,
  internet_raw TEXT,
  qos_raw TEXT,
  validity_raw TEXT,
  apn_raw TEXT,
  install_benchmark_raw TEXT,
  activation_policy_raw TEXT,
  mcc_raw TEXT,
  mnc_raw TEXT,
  flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_block JSONB NOT NULL,
  raw_row JSONB NOT NULL,
  classification_conflict BOOLEAN NOT NULL DEFAULT false,
  classification_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bongsim_product_option_price_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_api_id TEXT NOT NULL REFERENCES bongsim_product_option (option_api_id) ON DELETE CASCADE,
  workbook_id TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  row_hash TEXT NOT NULL,
  price_block JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bongsim_product_option_price_event_option_idx
  ON bongsim_product_option_price_event (option_api_id, ingested_at DESC);

-- 체크아웃 연락처·카카오 ID: 현재는 `consents` JSONB 에만 저장됨. 전용 컬럼이 필요하면 `buyer_tel`, `kakao_id` 등 ALTER 로 추가 후 앱 INSERT 분리.
CREATE TABLE IF NOT EXISTS bongsim_order (
  order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,
  status TEXT NOT NULL,
  checkout_channel TEXT NOT NULL DEFAULT 'web',
  buyer_email TEXT NOT NULL,
  buyer_locale TEXT,
  idempotency_key TEXT NOT NULL,
  consents JSONB NOT NULL DEFAULT '{}'::jsonb,
  currency TEXT NOT NULL DEFAULT 'KRW',
  subtotal_krw BIGINT NOT NULL,
  discount_krw BIGINT NOT NULL DEFAULT 0,
  tax_krw BIGINT NOT NULL DEFAULT 0,
  grand_total_krw BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bongsim_order_order_number_uniq UNIQUE (order_number),
  CONSTRAINT bongsim_order_idempotency_uniq UNIQUE (idempotency_key)
);

CREATE TABLE IF NOT EXISTS bongsim_order_line (
  line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES bongsim_order (order_id) ON DELETE CASCADE,
  option_api_id TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  charged_unit_price_krw BIGINT NOT NULL,
  line_total_krw BIGINT NOT NULL,
  charged_basis_key TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bongsim_order_line_order_idx ON bongsim_order_line (order_id);

CREATE TABLE IF NOT EXISTS bongsim_payment_attempt (
  payment_attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES bongsim_order (order_id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_session_id TEXT,
  amount_krw BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KRW',
  return_urls JSONB,
  last_error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bongsim_payment_attempt_order_idempotency_uniq UNIQUE (order_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS bongsim_payment_attempt_order_idx ON bongsim_payment_attempt (order_id);

CREATE TABLE IF NOT EXISTS bongsim_payment_provider_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  payment_attempt_id UUID REFERENCES bongsim_payment_attempt (payment_attempt_id) ON DELETE SET NULL,
  order_id UUID REFERENCES bongsim_order (order_id) ON DELETE SET NULL,
  payload_json JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bongsim_payment_provider_event_dedupe_uniq UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS bongsim_payment_provider_event_order_idx ON bongsim_payment_provider_event (order_id);

CREATE TABLE IF NOT EXISTS bongsim_fulfillment_job (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES bongsim_order (order_id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  last_error JSONB,
  supplier_submission_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bongsim_fulfillment_job_one_active_per_order
  ON bongsim_fulfillment_job (order_id)
  WHERE status IN ('queued', 'in_progress', 'submitted', 'acknowledged', 'profile_issued');

CREATE INDEX IF NOT EXISTS bongsim_fulfillment_job_order_idx ON bongsim_fulfillment_job (order_id);

CREATE TABLE IF NOT EXISTS bongsim_fulfillment_event (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES bongsim_order (order_id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES bongsim_fulfillment_job (job_id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  payload_ref TEXT,
  payload_hash TEXT,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bongsim_fulfillment_event_order_idx ON bongsim_fulfillment_event (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bongsim_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  payload JSONB NOT NULL,
  dedupe_key TEXT NOT NULL,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  CONSTRAINT bongsim_outbox_dedupe_uniq UNIQUE (dedupe_key)
);

CREATE INDEX IF NOT EXISTS bongsim_outbox_poll_idx
  ON bongsim_outbox (available_at)
  WHERE processed_at IS NULL;

COMMIT;
