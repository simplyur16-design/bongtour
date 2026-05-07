-- B-CRUD-1 (Supabase apply_migration): BongBlogPost.contentTrack + BongContentStatus 확장
-- Prisma 동기: prisma/migrations/20260507200000_bong_blog_post_content_track/migration.sql

ALTER TYPE "BongContentStatus" ADD VALUE 'scheduled';
ALTER TYPE "BongContentStatus" ADD VALUE 'rejected';

ALTER TABLE "BongBlogPost" ADD COLUMN "contentTrack" TEXT NOT NULL DEFAULT 'package';

CREATE INDEX "BongBlogPost_contentTrack_status_idx" ON "BongBlogPost"("contentTrack", "status");
CREATE INDEX "BongBlogPost_contentTrack_monthKey_idx" ON "BongBlogPost"("contentTrack", "monthKey");
