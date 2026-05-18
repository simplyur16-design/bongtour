-- 패키지 예약 접수: 신청자 신원·개인정보 동의 필드
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "customerNameKo" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "customerNameEn" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "customerBirthDate" TIMESTAMPTZ;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "privacyAgreed" BOOLEAN;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "privacyNoticeVersion" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "privacyAgreedAt" TIMESTAMPTZ;
