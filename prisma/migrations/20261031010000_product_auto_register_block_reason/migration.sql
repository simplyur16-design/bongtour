-- 자동 등록(사진 자동 채움 → 자동 검사 → registered) 보류 사유 칸. 2026-10-31 사장님 00:21 지시.
-- ADDITIVE ONLY: two nullable columns on "Product", no default rewrite, no drop, no data change.
-- GRANT: none added or revoked. New columns inherit the existing table-level grants on "Product".
-- RLS: unchanged. "Product" RLS state and policies are not touched by this migration;
--      the columns are covered by the same row policies as the rest of "Product".
-- Not applied by the agent (no DB write). Apply only after owner approval, after the backup step.
-- Rollback: rollback.sql in this folder.
-- REGRESSION-FREEZE[register-auto-register-gate]: additive columns only, no grant, no revoke, no RLS change — manifest

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "autoRegisterBlockReason" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "autoRegisterCheckedAt" TIMESTAMP(3);
