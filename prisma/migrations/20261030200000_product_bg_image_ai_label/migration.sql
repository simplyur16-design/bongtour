-- WORK-ORDER 8 stage 4 (AI label): 사장님 2026-10-30 19:34 KST "AI 표시 칸 추가해".
-- ADDITIVE ONLY: two nullable columns on "Product", no default rewrite, no drop, no data change.
-- Column-only change: table GRANTs and RLS on "Product" are intentionally unchanged by this migration
-- (봉실장 2026-10-30: permission changes are out of the approved scope "DB 칸 추가").
-- AI-generated flag = existing "bgImageIsGenerated" (BOOLEAN NOT NULL DEFAULT false, already in DB) — not duplicated.
-- Backup before apply: scripts/ops/backup-product-image-fields-20261030.sh (pg_dump of "Product", not run by this migration).
-- Rollback: prisma/migrations/20261030200000_product_bg_image_ai_label/rollback.sql
-- REGRESSION-FREEZE[product-image-stage4-1030]: additive columns only, no GRANT/REVOKE/RLS — manifest

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "bgImageAiPrompt" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "bgImageAiLabeledAt" TIMESTAMP(3);
