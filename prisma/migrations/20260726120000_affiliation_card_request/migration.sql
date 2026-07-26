-- eSIM 소속 명함 승인 + User.affiliationVerified
-- REGRESSION-FREEZE[bongsim-affiliation-card-ocr]: migration — manifest

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "affiliationVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "affiliationVerifiedAt" TIMESTAMP(6);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "affiliationOrgName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "affiliationCardImageUrl" TEXT;

CREATE TABLE IF NOT EXISTS "bongsim_affiliation_card_request" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "image_object_key" TEXT NOT NULL,
  "image_url" TEXT NOT NULL,
  "ocr_raw_json" TEXT,
  "ocr_name" TEXT,
  "ocr_company" TEXT,
  "ocr_email" TEXT,
  "ocr_phone" TEXT,
  "ocr_position" TEXT,
  "admin_note" TEXT,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bongsim_affiliation_card_request_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_affil_card_status_created"
  ON "bongsim_affiliation_card_request" ("status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_affil_card_user_created"
  ON "bongsim_affiliation_card_request" ("user_id", "created_at" DESC);
