-- WORK-ORDER 8 stage 4 (AI label): 사장님 2026-10-30 19:34 KST "AI 표시 칸 추가해".
-- ADDITIVE ONLY: nullable columns, no default rewrite, no drop, no data change.
-- AI-generated flag = existing "bgImageIsGenerated" (BOOLEAN NOT NULL DEFAULT false, already in DB) — not duplicated.
-- New: prompt record + labeled-at timestamp (both nullable).
-- Backup before apply: scripts/ops/backup-product-image-fields-20261030.sh (pg_dump of "Product", not run by this migration).
-- Rollback: prisma/migrations/20261030200000_product_bg_image_ai_label/rollback.sql
-- REGRESSION-FREEZE[product-image-stage4-1030]: additive only + RLS/REVOKE/GRANT — manifest

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "bgImageAiPrompt" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "bgImageAiLabeledAt" TIMESTAMP(3);

-- Supabase exposure lock for the touched table (idempotent).
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Product" FROM anon;
REVOKE ALL ON TABLE "Product" FROM authenticated;
GRANT ALL ON TABLE "Product" TO postgres;
GRANT ALL ON TABLE "Product" TO service_role;
