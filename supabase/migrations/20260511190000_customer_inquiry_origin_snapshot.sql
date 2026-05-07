-- D-INQUIRY: CustomerInquiry 공급사 원문·코드 스냅샷
ALTER TABLE "CustomerInquiry" ADD COLUMN IF NOT EXISTS "snapshotOriginUrl" TEXT;
ALTER TABLE "CustomerInquiry" ADD COLUMN IF NOT EXISTS "snapshotOriginSource" TEXT;
ALTER TABLE "CustomerInquiry" ADD COLUMN IF NOT EXISTS "snapshotOriginCode" TEXT;
