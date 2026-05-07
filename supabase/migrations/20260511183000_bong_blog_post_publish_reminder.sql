-- B-publish: 게시 예약 알림·자동 published 전환용
ALTER TABLE "BongBlogPost" ADD COLUMN IF NOT EXISTS "publishReminderSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "BongBlogPost_status_scheduledAt_idx" ON "BongBlogPost"("status", "scheduledAt");
