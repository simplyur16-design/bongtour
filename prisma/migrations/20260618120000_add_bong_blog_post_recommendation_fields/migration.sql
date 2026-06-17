-- BongBlogPost: 시즌 추천·블로그 자동 생성 메타
ALTER TABLE "BongBlogPost" ADD COLUMN IF NOT EXISTS "season" TEXT;
ALTER TABLE "BongBlogPost" ADD COLUMN IF NOT EXISTS "tripNights" INTEGER;
ALTER TABLE "BongBlogPost" ADD COLUMN IF NOT EXISTS "tripDays" INTEGER;
ALTER TABLE "BongBlogPost" ADD COLUMN IF NOT EXISTS "recommendationMeta" JSONB;
