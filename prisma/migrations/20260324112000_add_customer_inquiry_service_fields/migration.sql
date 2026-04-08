-- CustomerInquiry 운영 필드 확장
-- - selectedServiceType
-- - privacyNoticeConfirmedAt
-- - emailSentStatus
-- - emailSentAt
--
-- NOTE:
-- 현재 운영 DB가 이미 db push로 동기화된 경우 컬럼이 존재할 수 있습니다.
-- 새 환경/마이그레이션 기준 환경에서는 아래 ALTER가 정상 적용됩니다.

ALTER TABLE "CustomerInquiry" ADD COLUMN "selectedServiceType" TEXT;
ALTER TABLE "CustomerInquiry" ADD COLUMN "privacyNoticeConfirmedAt" DATETIME;
ALTER TABLE "CustomerInquiry" ADD COLUMN "emailSentStatus" TEXT;
ALTER TABLE "CustomerInquiry" ADD COLUMN "emailSentAt" DATETIME;

