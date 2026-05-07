-- Booking: 공개 접수번호(BP-…) + UTM·유입 스냅샷
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "bookingNumber" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "utmSource" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "utmMedium" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "utmContent" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "utmTerm" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "referrer" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "landingPath" TEXT;

-- CustomerInquiry: 공개 접수번호(BI-…) + 동일 UTM·유입 스냅샷
ALTER TABLE "CustomerInquiry" ADD COLUMN IF NOT EXISTS "inquiryNumber" TEXT;
ALTER TABLE "CustomerInquiry" ADD COLUMN IF NOT EXISTS "utmSource" TEXT;
ALTER TABLE "CustomerInquiry" ADD COLUMN IF NOT EXISTS "utmMedium" TEXT;
ALTER TABLE "CustomerInquiry" ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT;
ALTER TABLE "CustomerInquiry" ADD COLUMN IF NOT EXISTS "utmContent" TEXT;
ALTER TABLE "CustomerInquiry" ADD COLUMN IF NOT EXISTS "utmTerm" TEXT;
ALTER TABLE "CustomerInquiry" ADD COLUMN IF NOT EXISTS "referrer" TEXT;
ALTER TABLE "CustomerInquiry" ADD COLUMN IF NOT EXISTS "landingPath" TEXT;

-- 기존 행 백필 (접수번호 미부여분)
UPDATE "Booking"
SET "bookingNumber" = 'BP-' || to_char(COALESCE("createdAt", CURRENT_TIMESTAMP), 'YYYYMMDD') || '-' ||
  upper(substring(md5(random()::text || "id"::text || random()::text) from 1 for 8))
WHERE "bookingNumber" IS NULL OR btrim("bookingNumber") = '';

UPDATE "CustomerInquiry"
SET "inquiryNumber" = 'BI-' || to_char(COALESCE("createdAt", CURRENT_TIMESTAMP), 'YYYYMMDD') || '-' ||
  upper(substring(md5(random()::text || "id" || random()::text) from 1 for 8))
WHERE "inquiryNumber" IS NULL OR btrim("inquiryNumber") = '';

CREATE UNIQUE INDEX IF NOT EXISTS "Booking_bookingNumber_key" ON "Booking"("bookingNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerInquiry_inquiryNumber_key" ON "CustomerInquiry"("inquiryNumber");

ALTER TABLE "Booking" ALTER COLUMN "bookingNumber" SET NOT NULL;
ALTER TABLE "CustomerInquiry" ALTER COLUMN "inquiryNumber" SET NOT NULL;
