-- BongBlogPost: 카드뉴스 시리즈 연결
ALTER TABLE "BongBlogPost"
  ADD COLUMN IF NOT EXISTS "linkedCardNewsSeriesId" TEXT;

CREATE INDEX IF NOT EXISTS "BongBlogPost_linkedCardNewsSeriesId_idx"
  ON "BongBlogPost" ("linkedCardNewsSeriesId");
