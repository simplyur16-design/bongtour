-- BongBlogPost: SEO hashtags
ALTER TABLE "BongBlogPost"
  ADD COLUMN IF NOT EXISTS "hashtags" TEXT[] DEFAULT '{}';
