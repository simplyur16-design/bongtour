-- B-CRUD-1: BongBlogPost.contentTrack + BongContentStatus(scheduled, rejected)
-- Supabase 동기: supabase/migrations/20260507200000_bong_blog_post_content_track.sql

ALTER TYPE "BongContentStatus" ADD VALUE 'scheduled';
ALTER TYPE "BongContentStatus" ADD VALUE 'rejected';

ALTER TABLE "BongBlogPost" ADD COLUMN "contentTrack" TEXT NOT NULL DEFAULT 'package';

CREATE INDEX "BongBlogPost_contentTrack_status_idx" ON "BongBlogPost"("contentTrack", "status");
CREATE INDEX "BongBlogPost_contentTrack_monthKey_idx" ON "BongBlogPost"("contentTrack", "monthKey");
