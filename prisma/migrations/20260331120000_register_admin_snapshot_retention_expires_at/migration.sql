-- AlterTable: 관리자 등록 스냅샷 보관 만료 시각 (cleanup 스크립트 기준)
ALTER TABLE "RegisterAdminInputSnapshot" ADD COLUMN "retentionExpiresAt" DATETIME;

-- CreateIndex
CREATE INDEX "RegisterAdminInputSnapshot_retentionExpiresAt_idx" ON "RegisterAdminInputSnapshot"("retentionExpiresAt");
