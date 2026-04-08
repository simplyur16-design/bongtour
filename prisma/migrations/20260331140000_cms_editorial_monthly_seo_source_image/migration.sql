-- EditorialContent: 히어로 이미지, 출처, SEO
ALTER TABLE "EditorialContent" ADD COLUMN "heroImageUrl" TEXT;
ALTER TABLE "EditorialContent" ADD COLUMN "heroImageAlt" TEXT;
ALTER TABLE "EditorialContent" ADD COLUMN "heroImageStorageKey" TEXT;
ALTER TABLE "EditorialContent" ADD COLUMN "heroImageWidth" INTEGER;
ALTER TABLE "EditorialContent" ADD COLUMN "heroImageHeight" INTEGER;
ALTER TABLE "EditorialContent" ADD COLUMN "sourceType" TEXT;
ALTER TABLE "EditorialContent" ADD COLUMN "sourceName" TEXT;
ALTER TABLE "EditorialContent" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "EditorialContent" ADD COLUMN "seoTitle" TEXT;
ALTER TABLE "EditorialContent" ADD COLUMN "seoDescription" TEXT;
ALTER TABLE "EditorialContent" ADD COLUMN "slug" TEXT;

-- MonthlyCurationContent: 출처, SEO
ALTER TABLE "MonthlyCurationContent" ADD COLUMN "sourceType" TEXT;
ALTER TABLE "MonthlyCurationContent" ADD COLUMN "sourceName" TEXT;
ALTER TABLE "MonthlyCurationContent" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "MonthlyCurationContent" ADD COLUMN "seoTitle" TEXT;
ALTER TABLE "MonthlyCurationContent" ADD COLUMN "seoDescription" TEXT;
ALTER TABLE "MonthlyCurationContent" ADD COLUMN "slug" TEXT;
