-- 패키지 예약 접수: 신청자 신원·개인정보 동의 필드
ALTER TABLE "Booking" ADD COLUMN "customerNameKo" TEXT;
ALTER TABLE "Booking" ADD COLUMN "customerNameEn" TEXT;
ALTER TABLE "Booking" ADD COLUMN "customerBirthDate" DATETIME;
ALTER TABLE "Booking" ADD COLUMN "privacyAgreed" BOOLEAN;
ALTER TABLE "Booking" ADD COLUMN "privacyNoticeVersion" TEXT;
ALTER TABLE "Booking" ADD COLUMN "privacyAgreedAt" DATETIME;
