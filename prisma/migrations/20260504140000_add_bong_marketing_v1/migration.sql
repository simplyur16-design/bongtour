-- B-2: 봉투어 자동 광고 시스템 v1 — 신규 테이블·enum·Product↔BongSpot M:N (기존 테이블 컬럼 변경 없음)
-- CreateEnum
CREATE TYPE "BongContentStatus" AS ENUM ('draft', 'approved', 'published');

CREATE TYPE "BongDraftReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "BongSpot" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "summary" TEXT,
    "body" TEXT,
    "country" TEXT,
    "city" TEXT,
    "countryKey" TEXT,
    "cityKey" TEXT,
    "heroImageUrl" TEXT,
    "status" "BongContentStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BongSpot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BongSeasonalNote" (
    "id" TEXT NOT NULL,
    "bongSpotId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "status" "BongContentStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BongSeasonalNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BongFood" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "country" TEXT,
    "city" TEXT,
    "countryKey" TEXT,
    "cityKey" TEXT,
    "status" "BongContentStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BongFood_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BongTip" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "tipKind" TEXT,
    "country" TEXT,
    "city" TEXT,
    "countryKey" TEXT,
    "cityKey" TEXT,
    "status" "BongContentStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BongTip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BongCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "geminiCacheJson" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "status" "BongContentStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BongCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BongBlogPost" (
    "id" TEXT NOT NULL,
    "naverPostKey" TEXT,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "url" TEXT,
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "status" "BongContentStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BongBlogPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BongFacebookPost" (
    "id" TEXT NOT NULL,
    "facebookPostId" TEXT,
    "title" TEXT,
    "body" TEXT,
    "url" TEXT,
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "status" "BongContentStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BongFacebookPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductBongSpot" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "bongSpotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductBongSpot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BongSpotDraft" (
    "id" TEXT NOT NULL,
    "bongSpotId" TEXT,
    "title" TEXT,
    "payloadJson" JSONB,
    "country" TEXT,
    "city" TEXT,
    "countryKey" TEXT,
    "cityKey" TEXT,
    "status" "BongDraftReviewStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BongSpotDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BongFoodDraft" (
    "id" TEXT NOT NULL,
    "bongFoodId" TEXT,
    "name" TEXT,
    "payloadJson" JSONB,
    "countryKey" TEXT,
    "cityKey" TEXT,
    "status" "BongDraftReviewStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BongFoodDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BongTipDraft" (
    "id" TEXT NOT NULL,
    "bongTipId" TEXT,
    "title" TEXT,
    "payloadJson" JSONB,
    "countryKey" TEXT,
    "cityKey" TEXT,
    "status" "BongDraftReviewStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BongTipDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BongSpot_slug_key" ON "BongSpot"("slug");

CREATE INDEX "BongSpot_country_city_idx" ON "BongSpot"("country", "city");

CREATE INDEX "BongSpot_countryKey_cityKey_idx" ON "BongSpot"("countryKey", "cityKey");

CREATE INDEX "BongSpot_status_idx" ON "BongSpot"("status");

CREATE UNIQUE INDEX "BongSeasonalNote_bongSpotId_month_key" ON "BongSeasonalNote"("bongSpotId", "month");

CREATE INDEX "BongSeasonalNote_status_idx" ON "BongSeasonalNote"("status");

CREATE INDEX "BongFood_countryKey_cityKey_idx" ON "BongFood"("countryKey", "cityKey");

CREATE INDEX "BongFood_status_idx" ON "BongFood"("status");

CREATE INDEX "BongTip_countryKey_idx" ON "BongTip"("countryKey");

CREATE INDEX "BongTip_countryKey_cityKey_idx" ON "BongTip"("countryKey", "cityKey");

CREATE INDEX "BongTip_status_idx" ON "BongTip"("status");

CREATE INDEX "BongCampaign_windowStart_windowEnd_idx" ON "BongCampaign"("windowStart", "windowEnd");

CREATE INDEX "BongCampaign_scheduledAt_idx" ON "BongCampaign"("scheduledAt");

CREATE INDEX "BongCampaign_status_idx" ON "BongCampaign"("status");

CREATE UNIQUE INDEX "BongBlogPost_naverPostKey_key" ON "BongBlogPost"("naverPostKey");

CREATE INDEX "BongBlogPost_publishedAt_idx" ON "BongBlogPost"("publishedAt");

CREATE INDEX "BongBlogPost_scheduledAt_idx" ON "BongBlogPost"("scheduledAt");

CREATE INDEX "BongBlogPost_status_idx" ON "BongBlogPost"("status");

CREATE UNIQUE INDEX "BongFacebookPost_facebookPostId_key" ON "BongFacebookPost"("facebookPostId");

CREATE INDEX "BongFacebookPost_publishedAt_idx" ON "BongFacebookPost"("publishedAt");

CREATE INDEX "BongFacebookPost_scheduledAt_idx" ON "BongFacebookPost"("scheduledAt");

CREATE INDEX "BongFacebookPost_status_idx" ON "BongFacebookPost"("status");

CREATE UNIQUE INDEX "ProductBongSpot_productId_bongSpotId_key" ON "ProductBongSpot"("productId", "bongSpotId");

CREATE INDEX "ProductBongSpot_bongSpotId_idx" ON "ProductBongSpot"("bongSpotId");

CREATE INDEX "BongSpotDraft_bongSpotId_idx" ON "BongSpotDraft"("bongSpotId");

CREATE INDEX "BongSpotDraft_status_idx" ON "BongSpotDraft"("status");

CREATE INDEX "BongSpotDraft_countryKey_cityKey_idx" ON "BongSpotDraft"("countryKey", "cityKey");

CREATE INDEX "BongFoodDraft_bongFoodId_idx" ON "BongFoodDraft"("bongFoodId");

CREATE INDEX "BongFoodDraft_status_idx" ON "BongFoodDraft"("status");

CREATE INDEX "BongTipDraft_bongTipId_idx" ON "BongTipDraft"("bongTipId");

CREATE INDEX "BongTipDraft_status_idx" ON "BongTipDraft"("status");

-- AddForeignKey
ALTER TABLE "BongSeasonalNote" ADD CONSTRAINT "BongSeasonalNote_bongSpotId_fkey" FOREIGN KEY ("bongSpotId") REFERENCES "BongSpot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductBongSpot" ADD CONSTRAINT "ProductBongSpot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductBongSpot" ADD CONSTRAINT "ProductBongSpot_bongSpotId_fkey" FOREIGN KEY ("bongSpotId") REFERENCES "BongSpot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BongSpotDraft" ADD CONSTRAINT "BongSpotDraft_bongSpotId_fkey" FOREIGN KEY ("bongSpotId") REFERENCES "BongSpot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BongFoodDraft" ADD CONSTRAINT "BongFoodDraft_bongFoodId_fkey" FOREIGN KEY ("bongFoodId") REFERENCES "BongFood"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BongTipDraft" ADD CONSTRAINT "BongTipDraft_bongTipId_fkey" FOREIGN KEY ("bongTipId") REFERENCES "BongTip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
