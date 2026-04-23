-- USIMSA supplier 연동을 위한 스키마 확장 (PostgreSQL).
--
-- 설계 요지:
--   * POST /api/v2/order 응답이 products[] 형태로 N개 topupId를 즉시 반환 → 1 order = N topup 관계.
--     기존 bongsim_fulfillment_job의 단수 컬럼(supplier_submission_id / supplier_iccid 등)으로는 표현 불가.
--   * 따라서 job은 "주문 단위 제출 집계"로 유지하고, topup 단위 실체를 자식 테이블로 분리.
--   * webhook(비동기 ICCID 발급) 수신은 topup 단위로 일어남.
--   * 기존 mock 경로는 하위호환 — supplier_submission_id / supplier_iccid 컬럼은 nullable 유지.

BEGIN;

-- 1) bongsim_fulfillment_job: supplier 연동 집계용 컬럼
ALTER TABLE bongsim_fulfillment_job
  ADD COLUMN IF NOT EXISTS supplier_id         TEXT,
  ADD COLUMN IF NOT EXISTS supplier_order_ref  TEXT,
  ADD COLUMN IF NOT EXISTS submission_payload  JSONB,
  ADD COLUMN IF NOT EXISTS submission_response JSONB,
  ADD COLUMN IF NOT EXISTS submitted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_polled_at      TIMESTAMPTZ;

-- supplier_order_ref = USIMSA에 보낸 partner orderId(우리 order_number)
-- supplier_id + supplier_order_ref로 "같은 주문 재제출" 차단
CREATE UNIQUE INDEX IF NOT EXISTS bongsim_fulfillment_job_supplier_ref_uq
  ON bongsim_fulfillment_job (supplier_id, supplier_order_ref)
  WHERE supplier_id IS NOT NULL AND supplier_order_ref IS NOT NULL;

-- 2) bongsim_fulfillment_topup: topup(ICCID) 단위 자식 테이블
CREATE TABLE IF NOT EXISTS bongsim_fulfillment_topup (
  topup_row_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              UUID NOT NULL REFERENCES bongsim_fulfillment_job(job_id) ON DELETE CASCADE,
  order_id            UUID NOT NULL REFERENCES bongsim_order(order_id) ON DELETE CASCADE,
  option_api_id       TEXT NOT NULL,
  supplier_id         TEXT NOT NULL,
  topup_id            TEXT NOT NULL,
  -- status flow: issued_topup -> iccid_ready -> delivered
  --                                          \-> canceled
  --                                          \-> failed
  status              TEXT NOT NULL DEFAULT 'issued_topup',
  iccid               TEXT,
  smdp                TEXT,
  activate_code       TEXT,
  download_link       TEXT,
  qr_code_img_url     TEXT,
  expired_date        DATE,
  webhook_received_at TIMESTAMPTZ,
  webhook_payload     JSONB,
  canceled_at         TIMESTAMPTZ,
  last_error          JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bongsim_fulfillment_topup_supplier_uniq UNIQUE (supplier_id, topup_id)
);

CREATE INDEX IF NOT EXISTS bongsim_fulfillment_topup_job_idx
  ON bongsim_fulfillment_topup (job_id);
CREATE INDEX IF NOT EXISTS bongsim_fulfillment_topup_order_idx
  ON bongsim_fulfillment_topup (order_id);
CREATE INDEX IF NOT EXISTS bongsim_fulfillment_topup_status_idx
  ON bongsim_fulfillment_topup (status)
  WHERE status IN ('issued_topup', 'failed');

-- 3) bongsim_supplier_api_log: 감사·디버깅용 원시 API 로그
CREATE TABLE IF NOT EXISTS bongsim_supplier_api_log (
  log_id        BIGSERIAL PRIMARY KEY,
  supplier_id   TEXT NOT NULL,
  order_id      UUID REFERENCES bongsim_order(order_id) ON DELETE SET NULL,
  job_id        UUID REFERENCES bongsim_fulfillment_job(job_id) ON DELETE SET NULL,
  direction     TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound_webhook')),
  endpoint      TEXT,
  http_status   INT,
  request_body  JSONB,
  response_body JSONB,
  duration_ms   INT,
  error_code    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bongsim_supplier_api_log_order_idx
  ON bongsim_supplier_api_log (order_id);
CREATE INDEX IF NOT EXISTS bongsim_supplier_api_log_job_idx
  ON bongsim_supplier_api_log (job_id);
CREATE INDEX IF NOT EXISTS bongsim_supplier_api_log_created_idx
  ON bongsim_supplier_api_log (created_at DESC);
CREATE INDEX IF NOT EXISTS bongsim_supplier_api_log_supplier_direction_idx
  ON bongsim_supplier_api_log (supplier_id, direction, created_at DESC);

COMMIT;
