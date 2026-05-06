-- B-4-2 (Supabase apply_migration): BongBlogPost 패키지 네이버 블로그 초안 필드 + Product FK
-- Prisma 동기: prisma/migrations/20260506140000_bong_blog_post_package_draft_fields/migration.sql

ALTER TABLE "BongBlogPost" ADD COLUMN "body" TEXT;
ALTER TABLE "BongBlogPost" ADD COLUMN "linkedProductId" TEXT;
ALTER TABLE "BongBlogPost" ADD COLUMN "monthKey" TEXT;
ALTER TABLE "BongBlogPost" ADD COLUMN "citySlug" TEXT;
ALTER TABLE "BongBlogPost" ADD COLUMN "countrySlug" TEXT;
ALTER TABLE "BongBlogPost" ADD COLUMN "generationModel" TEXT;
ALTER TABLE "BongBlogPost" ADD COLUMN "generationPromptVersion" TEXT;
ALTER TABLE "BongBlogPost" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "BongBlogPost" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "BongBlogPost" ADD COLUMN "rejectedReason" TEXT;

CREATE INDEX "BongBlogPost_monthKey_status_idx" ON "BongBlogPost"("monthKey", "status");
CREATE INDEX "BongBlogPost_linkedProductId_idx" ON "BongBlogPost"("linkedProductId");
CREATE INDEX "BongBlogPost_citySlug_monthKey_idx" ON "BongBlogPost"("citySlug", "monthKey");

ALTER TABLE "BongBlogPost" ADD CONSTRAINT "BongBlogPost_linkedProductId_fkey" FOREIGN KEY ("linkedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
