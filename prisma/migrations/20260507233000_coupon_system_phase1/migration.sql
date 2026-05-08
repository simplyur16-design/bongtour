-- Phase 1: 사용자별 쿠폰·추천 코드 (운영 반영본과 동일 목적의 idempotent DDL)
-- bongsim_order / bongsim_coupon 전제. Prisma "User" 테이블.

-- -----------------------------------------------------------------------------
-- bongsim_coupon 확장
-- -----------------------------------------------------------------------------
ALTER TABLE bongsim_coupon ADD COLUMN IF NOT EXISTS coupon_kind text NOT NULL DEFAULT 'public_code';
ALTER TABLE bongsim_coupon ADD COLUMN IF NOT EXISTS template_validity_days integer;
ALTER TABLE bongsim_coupon ADD COLUMN IF NOT EXISTS template_label text;

-- -----------------------------------------------------------------------------
-- User (Prisma @@map 없음 — 기본 테이블명 "User")
-- -----------------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "birthDate" date;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredByCode" text;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredAt" timestamptz;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviterRewardedAt" timestamptz;

CREATE INDEX IF NOT EXISTS "User_birthDate_idx" ON "User" ("birthDate");
CREATE INDEX IF NOT EXISTS "User_referredByCode_idx" ON "User" ("referredByCode");

-- -----------------------------------------------------------------------------
-- bongsim_user_coupon
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bongsim_user_coupon (
  user_coupon_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  user_email text NOT NULL,
  source_coupon_id uuid NOT NULL REFERENCES bongsim_coupon (coupon_id) ON DELETE RESTRICT,
  issued_via text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  used_at timestamptz,
  used_order_id uuid REFERENCES bongsim_order (order_id) ON DELETE SET NULL,
  used_amount_krw bigint,
  issued_for_period text,
  notes text,
  expiry_reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bongsim_user_coupon_status_check CHECK (status IN ('active', 'used', 'expired', 'revoked'))
);

CREATE INDEX IF NOT EXISTS bongsim_user_coupon_user_id_idx ON bongsim_user_coupon (user_id);
CREATE INDEX IF NOT EXISTS bongsim_user_coupon_user_email_lower_idx ON bongsim_user_coupon (lower(trim(user_email)));
CREATE INDEX IF NOT EXISTS bongsim_user_coupon_status_expires_idx ON bongsim_user_coupon (status, expires_at);

-- partial UNIQUE 3종 (발급 멱등)
CREATE UNIQUE INDEX IF NOT EXISTS bongsim_user_coupon_uidx_welcome
  ON bongsim_user_coupon (user_id) WHERE issued_via = 'welcome';

CREATE UNIQUE INDEX IF NOT EXISTS bongsim_user_coupon_uidx_referral_invitee
  ON bongsim_user_coupon (user_id) WHERE issued_via = 'referral_invitee';

CREATE UNIQUE INDEX IF NOT EXISTS bongsim_user_coupon_uidx_review_notes
  ON bongsim_user_coupon (user_id, notes) WHERE issued_via = 'review';

-- -----------------------------------------------------------------------------
-- bongsim_referral_code
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bongsim_referral_code (
  referral_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id text NOT NULL,
  code text NOT NULL,
  inviter_template_coupon_id uuid REFERENCES bongsim_coupon (coupon_id) ON DELETE SET NULL,
  invitee_template_coupon_id uuid REFERENCES bongsim_coupon (coupon_id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  total_invited integer NOT NULL DEFAULT 0,
  total_rewarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bongsim_referral_code_inviter_user_id_key UNIQUE (inviter_user_id),
  CONSTRAINT bongsim_referral_code_code_key UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS bongsim_referral_code_code_lower_idx ON bongsim_referral_code (lower(trim(code)));

-- -----------------------------------------------------------------------------
-- 시드: 발급용 템플릿 쿠폰 5종 (코드 유니크가 없을 수 있어 NOT EXISTS 로 멱등 처리)
-- (유니크가 있으면 아래를 ON CONFLICT (code) DO NOTHING 으로 바꿔도 됨)
-- -----------------------------------------------------------------------------
INSERT INTO bongsim_coupon (
  code, description, discount_type, discount_value, max_discount_krw, min_order_krw,
  usage_limit, used_count, valid_from, valid_until, is_active,
  coupon_kind, template_validity_days, template_label
)
SELECT * FROM (VALUES
  ('__TPL_WELCOME_BONUS', '가입 환영 보너스 발급 템플릿', 'fixed', 5000::numeric, NULL::bigint, 0::bigint,
   999999999, 0, timestamptz '2000-01-01', timestamptz '2099-12-31', true,
   'issuance_template', 90, '가입 환영 쿠폰'),
  ('__TPL_BIRTHDAY', '생일 쿠폰 발급 템플릿', 'fixed', 10000::numeric, NULL::bigint, 0::bigint,
   999999999, 0, timestamptz '2000-01-01', timestamptz '2099-12-31', true,
   'issuance_template', 30, '생일 축하 쿠폰'),
  ('__TPL_REVIEW_REWARD', '리뷰 보상 발급 템플릿', 'fixed', 3000::numeric, NULL::bigint, 0::bigint,
   999999999, 0, timestamptz '2000-01-01', timestamptz '2099-12-31', true,
   'issuance_template', 60, '리뷰 감사 쿠폰'),
  ('__TPL_REFERRAL_INVITER', '추천인(친구 첫결제) 보상 템플릿', 'fixed', 5000::numeric, NULL::bigint, 0::bigint,
   999999999, 0, timestamptz '2000-01-01', timestamptz '2099-12-31', true,
   'issuance_template', 90, '친구 첫 결제 추천인 보상'),
  ('__TPL_REFERRAL_INVITEE', '피추천인 가입 보너스 템플릿', 'fixed', 5000::numeric, NULL::bigint, 0::bigint,
   999999999, 0, timestamptz '2000-01-01', timestamptz '2099-12-31', true,
   'issuance_template', 90, '친구 추천 가입 보너스')
) AS v(code, description, discount_type, discount_value, max_discount_krw, min_order_krw,
       usage_limit, used_count, valid_from, valid_until, is_active,
       coupon_kind, template_validity_days, template_label)
WHERE NOT EXISTS (SELECT 1 FROM bongsim_coupon c WHERE c.code = v.code);
