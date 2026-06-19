-- PR 별건 #12+#16: BongPostInsight Facebook platform fields (Media Views API)
ALTER TABLE "BongPostInsight" ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'instagram';
ALTER TABLE "BongPostInsight" ADD COLUMN "fbPostId" TEXT;
ALTER TABLE "BongPostInsight" ADD COLUMN "pageId" TEXT;
ALTER TABLE "BongPostInsight" ADD COLUMN "fbReactionsTotal" INTEGER;

CREATE UNIQUE INDEX "BongPostInsight_fbPostId_key" ON "BongPostInsight"("fbPostId");
CREATE INDEX "BongPostInsight_platform_idx" ON "BongPostInsight"("platform");

-- Backfill platform from legacy sourceType
UPDATE "BongPostInsight"
SET "platform" = 'instagram'
WHERE "instaMediaId" IS NOT NULL
   OR "sourceType" = 'instagram-organic';

UPDATE "BongPostInsight"
SET "platform" = 'facebook',
    "pageId" = '354829461058288'
WHERE "sourceType" = 'facebook-page-post'
   OR ("instaMediaId" IS NULL AND "sourceType" IS DISTINCT FROM 'instagram-organic' AND "permalink" LIKE '%facebook.com%');

-- Extract fbPostId from /posts/{numericId} permalinks (봉투어 pageId 고정)
UPDATE "BongPostInsight"
SET "fbPostId" = '354829461058288_' || (regexp_match("permalink", '/posts/([0-9]+)'))[1]
WHERE "platform" = 'facebook'
  AND "fbPostId" IS NULL
  AND "permalink" ~ '/posts/[0-9]+';
