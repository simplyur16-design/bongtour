-- D-INQUIRY: CustomerInquiry 공급사 원문·코드 스냅샷 (LMS·어드민 상세)
ALTER TABLE "CustomerInquiry" ADD COLUMN "snapshotOriginUrl" TEXT;
ALTER TABLE "CustomerInquiry" ADD COLUMN "snapshotOriginSource" TEXT;
ALTER TABLE "CustomerInquiry" ADD COLUMN "snapshotOriginCode" TEXT;
