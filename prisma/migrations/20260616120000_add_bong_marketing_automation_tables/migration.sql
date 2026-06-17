-- PR 1: 봉투어 마케팅 자동화 — 카드뉴스·컨텍스트·후킹·인사이트 (6 tables, Product FK only via BongCardNewsEpisode)
-- Apply: Supabase MCP apply_migration or `npx prisma migrate deploy`

-- CreateTable
CREATE TABLE "BongCardNewsSeries" (
    "id" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "themeTitle" TEXT NOT NULL,
    "selectedCities" TEXT[] NOT NULL,
    "targetDepartureFrom" TIMESTAMP(3) NOT NULL,
    "targetDepartureTo" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "operatorNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BongCardNewsSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BongCardNewsEpisode" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "episodeType" TEXT NOT NULL,
    "formatType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "linkedProductId" TEXT,
    "targetCity" TEXT,
    "targetPlace" TEXT,
    "operatorNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BongCardNewsEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BongCardNewsSlide" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "slideNumber" INTEGER NOT NULL,
    "slideRole" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "subtitle" TEXT,
    "body" TEXT,
    "pexelsKeyword" TEXT,
    "pexelsImageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BongCardNewsSlide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BongMarketingContext" (
    "id" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "themeIntent" TEXT,
    "targetAudience" TEXT,
    "hotInfo" TEXT,
    "avoidTone" TEXT,
    "customKeywords" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BongMarketingContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BongHookLibrary" (
    "id" TEXT NOT NULL,
    "hookType" TEXT NOT NULL,
    "hookText" TEXT NOT NULL,
    "context" TEXT,
    "category" TEXT,
    "source" TEXT,
    "tags" TEXT[] NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BongHookLibrary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BongPostInsight" (
    "id" TEXT NOT NULL,
    "instaMediaId" TEXT,
    "sourceType" TEXT,
    "sourceCardNewsSeriesId" TEXT,
    "sourceCardNewsEpisodeId" TEXT,
    "sourceBlogPostId" TEXT,
    "caption" TEXT,
    "permalink" TEXT,
    "publishedAt" TIMESTAMP(3),
    "reach" INTEGER,
    "impressions" INTEGER,
    "likes" INTEGER,
    "saved" INTEGER,
    "shares" INTEGER,
    "comments" INTEGER,
    "profileViews" INTEGER,
    "websiteClicks" INTEGER,
    "syncedAt" TIMESTAMP(3),
    "syncSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BongPostInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BongCardNewsSeries_weekKey_idx" ON "BongCardNewsSeries"("weekKey");

-- CreateIndex
CREATE INDEX "BongCardNewsSeries_status_idx" ON "BongCardNewsSeries"("status");

-- CreateIndex
CREATE INDEX "BongCardNewsSeries_createdAt_idx" ON "BongCardNewsSeries"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BongCardNewsEpisode_seriesId_episodeNumber_key" ON "BongCardNewsEpisode"("seriesId", "episodeNumber");

-- CreateIndex
CREATE INDEX "BongCardNewsEpisode_seriesId_idx" ON "BongCardNewsEpisode"("seriesId");

-- CreateIndex
CREATE INDEX "BongCardNewsEpisode_linkedProductId_idx" ON "BongCardNewsEpisode"("linkedProductId");

-- CreateIndex
CREATE UNIQUE INDEX "BongCardNewsSlide_episodeId_slideNumber_key" ON "BongCardNewsSlide"("episodeId", "slideNumber");

-- CreateIndex
CREATE INDEX "BongCardNewsSlide_episodeId_idx" ON "BongCardNewsSlide"("episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "BongMarketingContext_weekKey_key" ON "BongMarketingContext"("weekKey");

-- CreateIndex
CREATE INDEX "BongMarketingContext_weekKey_idx" ON "BongMarketingContext"("weekKey");

-- CreateIndex
CREATE INDEX "BongHookLibrary_hookType_idx" ON "BongHookLibrary"("hookType");

-- CreateIndex
CREATE INDEX "BongHookLibrary_category_idx" ON "BongHookLibrary"("category");

-- CreateIndex
CREATE INDEX "BongHookLibrary_isActive_idx" ON "BongHookLibrary"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BongPostInsight_instaMediaId_key" ON "BongPostInsight"("instaMediaId");

-- CreateIndex
CREATE INDEX "BongPostInsight_sourceType_idx" ON "BongPostInsight"("sourceType");

-- CreateIndex
CREATE INDEX "BongPostInsight_publishedAt_idx" ON "BongPostInsight"("publishedAt");

-- AddForeignKey
ALTER TABLE "BongCardNewsEpisode" ADD CONSTRAINT "BongCardNewsEpisode_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "BongCardNewsSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BongCardNewsEpisode" ADD CONSTRAINT "BongCardNewsEpisode_linkedProductId_fkey" FOREIGN KEY ("linkedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BongCardNewsSlide" ADD CONSTRAINT "BongCardNewsSlide_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "BongCardNewsEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
