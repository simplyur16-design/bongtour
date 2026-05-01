-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "originSource" TEXT NOT NULL,
    "originCode" TEXT NOT NULL,
    "originUrl" TEXT,
    "title" TEXT NOT NULL,
    "destination" TEXT,
    "destinationRaw" TEXT,
    "primaryDestination" TEXT,
    "countryKey" TEXT,
    "nodeKey" TEXT,
    "groupKey" TEXT,
    "locationMatchConfidence" TEXT,
    "locationMatchSource" TEXT,
    "duration" TEXT,
    "airline" TEXT,
    "supplierGroupId" TEXT,
    "bgImageUrl" TEXT,
    "bgImageSource" TEXT,
    "bgImageSourceType" TEXT,
    "bgImagePhotographer" TEXT,
    "bgImageSourceUrl" TEXT,
    "bgImageExternalId" TEXT,
    "bgImageStoragePath" TEXT,
    "bgImageStorageBucket" TEXT,
    "bgImageRehostSearchLabel" TEXT,
    "bgImagePlaceName" TEXT,
    "bgImageCityName" TEXT,
    "bgImageWidth" INTEGER,
    "bgImageHeight" INTEGER,
    "bgImageRehostedAt" TIMESTAMP(3),
    "bgImageIsGenerated" BOOLEAN NOT NULL DEFAULT false,
    "counselingNotes" TEXT,
    "schedule" TEXT,
    "isFuelIncluded" BOOLEAN,
    "isGuideFeeIncluded" BOOLEAN,
    "mandatoryLocalFee" DOUBLE PRECISION,
    "mandatoryCurrency" TEXT,
    "priceFrom" INTEGER,
    "priceCurrency" TEXT,
    "includedText" TEXT,
    "excludedText" TEXT,
    "criticalExclusions" TEXT,
    "shoppingCount" INTEGER,
    "shoppingItems" TEXT,
    "registrationStatus" TEXT DEFAULT 'pending',
    "rejectReason" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "needsImageReview" BOOLEAN NOT NULL DEFAULT false,
    "imageReviewRequestedAt" TIMESTAMP(3),
    "primaryRegion" TEXT,
    "themeTags" TEXT,
    "displayCategory" TEXT,
    "targetAudience" TEXT,
    "brandId" TEXT,
    "rawTitle" TEXT,
    "normalizedBaseTitle" TEXT,
    "variantLabelKey" TEXT,
    "supplierProductCode" TEXT,
    "productType" TEXT,
    "airtelHotelInfoJson" TEXT,
    "airportTransferType" TEXT,
    "summary" TEXT,
    "benefitSummary" TEXT,
    "tripNights" INTEGER,
    "tripDays" INTEGER,
    "shoppingVisitCountTotal" INTEGER,
    "shoppingCustomsNoticeRaw" TEXT,
    "shoppingRefundNoticeRaw" TEXT,
    "shoppingCautionNoticeRaw" TEXT,
    "shoppingShopOptions" TEXT,
    "optionalTourSummaryRaw" TEXT,
    "hasOptionalTours" BOOLEAN,
    "optionalToursStructured" TEXT,
    "cardBenefitSummaryShort" TEXT,
    "benefitMonthRef" TEXT,
    "hasMonthlyCardBenefit" BOOLEAN,
    "themeLabelsRaw" TEXT,
    "promotionLabelsRaw" TEXT,
    "insuranceSummaryRaw" TEXT,
    "hotelSummaryRaw" TEXT,
    "hotelSummaryText" TEXT,
    "foodSummaryRaw" TEXT,
    "reservationNoticeRaw" TEXT,
    "guideTypeRaw" TEXT,
    "tourLeaderTypeRaw" TEXT,
    "detailStatusLabelsRaw" TEXT,
    "rawMeta" TEXT,
    "minimumDepartureCount" INTEGER,
    "minimumDepartureText" TEXT,
    "isDepartureGuaranteed" BOOLEAN,
    "currentBookedCount" INTEGER,
    "departureStatusText" TEXT,
    "flightAdminJson" TEXT,
    "travelScope" TEXT,
    "listingKind" TEXT,
    "publicImageHeroSeoLine" TEXT,
    "publicImageHeroSeoKeywordsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionalTour" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceUsd" INTEGER NOT NULL,
    "duration" TEXT,
    "waitPlaceIfNotJoined" TEXT,

    CONSTRAINT "OptionalTour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPrice" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "adult" INTEGER NOT NULL,
    "childBed" INTEGER NOT NULL,
    "childNoBed" INTEGER NOT NULL,
    "infant" INTEGER NOT NULL,
    "localPrice" TEXT,
    "priceGap" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT NOT NULL,

    CONSTRAINT "ProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentScrapeReport" (
    "id" SERIAL NOT NULL,
    "productId" TEXT,
    "step" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "screenshotPath" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentScrapeReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperQueue" (
    "id" SERIAL NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScraperQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Itinerary" (
    "id" SERIAL NOT NULL,
    "productId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Itinerary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItineraryDay" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "dateText" TEXT,
    "city" TEXT,
    "summaryTextRaw" TEXT,
    "poiNamesRaw" TEXT,
    "meals" TEXT,
    "accommodation" TEXT,
    "hotelText" TEXT,
    "breakfastText" TEXT,
    "lunchText" TEXT,
    "dinnerText" TEXT,
    "mealSummaryText" TEXT,
    "transport" TEXT,
    "notes" TEXT,
    "rawBlock" TEXT,
    "heroImageBundle" TEXT,

    CONSTRAINT "ItineraryDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductDeparture" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "adultPrice" INTEGER,
    "childBedPrice" INTEGER,
    "childNoBedPrice" INTEGER,
    "infantPrice" INTEGER,
    "localPriceText" TEXT,
    "statusRaw" TEXT,
    "seatsStatusRaw" TEXT,
    "isConfirmed" BOOLEAN,
    "isBookable" BOOLEAN,
    "minPax" INTEGER,
    "syncedAt" TIMESTAMP(3),
    "carrierName" TEXT,
    "outboundFlightNo" TEXT,
    "outboundDepartureAirport" TEXT,
    "outboundDepartureAt" TIMESTAMP(3),
    "outboundArrivalAirport" TEXT,
    "outboundArrivalAt" TIMESTAMP(3),
    "inboundFlightNo" TEXT,
    "inboundDepartureAirport" TEXT,
    "inboundDepartureAt" TIMESTAMP(3),
    "inboundArrivalAirport" TEXT,
    "inboundArrivalAt" TIMESTAMP(3),
    "meetingInfoRaw" TEXT,
    "meetingPointRaw" TEXT,
    "meetingTerminalRaw" TEXT,
    "meetingGuideNoticeRaw" TEXT,
    "meetingDateRaw" TEXT,
    "statusLabelsRaw" TEXT,
    "reservationCount" INTEGER,
    "seatCount" INTEGER,
    "fuelSurchargeIncluded" BOOLEAN,
    "taxIncluded" BOOLEAN,
    "isDepartureConfirmed" BOOLEAN,
    "isAirConfirmed" BOOLEAN,
    "isScheduleConfirmed" BOOLEAN,
    "isHotelConfirmed" BOOLEAN,
    "isPriceConfirmed" BOOLEAN,
    "supplierDepartureCodeCandidate" TEXT,
    "matchingTraceRaw" TEXT,
    "transportType" TEXT,
    "boardingPlace" TEXT,
    "departureTimeText" TEXT,
    "returnTimeText" TEXT,
    "vehicleNote" TEXT,
    "transportSegmentRaw" TEXT,
    "supplierPriceKey" TEXT,

    CONSTRAINT "ProductDeparture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HanatourMonthlyBenefit" (
    "id" TEXT NOT NULL,
    "supplierKey" TEXT NOT NULL DEFAULT 'hanatour',
    "benefitMonth" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cardInstallmentBenefits" TEXT,
    "hanaExtraCards" TEXT,
    "commonNoticesRaw" TEXT,
    "benefitSummaryRaw" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "rawMeta" TEXT,

    CONSTRAINT "HanatourMonthlyBenefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "selectedDate" TIMESTAMP(3) NOT NULL,
    "preferredDepartureDate" TIMESTAMP(3),
    "pricingMode" TEXT,
    "adultCount" INTEGER NOT NULL,
    "childBedCount" INTEGER NOT NULL,
    "childNoBedCount" INTEGER NOT NULL,
    "infantCount" INTEGER NOT NULL,
    "totalKrwAmount" INTEGER NOT NULL,
    "totalLocalAmount" DOUBLE PRECISION NOT NULL,
    "localCurrency" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "requestNotes" TEXT,
    "preferredContactChannel" TEXT,
    "singleRoomRequested" BOOLEAN NOT NULL DEFAULT false,
    "childInfantBirthDatesJson" TEXT,
    "originSourceSnapshot" TEXT,
    "originCodeSnapshot" TEXT,
    "status" TEXT NOT NULL,
    "notificationStatus" TEXT,
    "notificationError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" TEXT,
    "passwordHash" TEXT,
    "phone" TEXT,
    "signupMethod" TEXT,
    "socialProvider" TEXT,
    "socialProviderUserId" TEXT,
    "accountStatus" TEXT NOT NULL DEFAULT 'active',
    "privacyNoticeConfirmedAt" TIMESTAMP(3),
    "privacyNoticeVersion" TEXT,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "marketingConsentAt" TIMESTAMP(3),
    "marketingConsentVersion" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Destination" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DestinationGalleryCache" (
    "id" TEXT NOT NULL,
    "destinationName" TEXT NOT NULL,
    "imageUrls" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DestinationGalleryCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DestinationImageSet" (
    "id" TEXT NOT NULL,
    "destinationName" TEXT NOT NULL,
    "mainImageUrl" TEXT,
    "mainImageSource" TEXT,
    "scheduleImageUrls" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DestinationImageSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoPool" (
    "id" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "attractionName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetUsageLog" (
    "id" TEXT NOT NULL,
    "assetId" TEXT,
    "assetPath" TEXT,
    "productId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "selectionMode" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "notes" TEXT,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "brandKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "logoPath" TEXT,
    "primaryColor" TEXT,
    "disclaimerText" TEXT,
    "officialUrl" TEXT,
    "productUrlTemplate" TEXT,
    "defaultTerms" TEXT,
    "cancelFeeTerms" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyCurationItem" (
    "id" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "destinationName" TEXT NOT NULL,
    "oneLineTheme" TEXT NOT NULL,
    "whyNowText" TEXT NOT NULL,
    "recommendedForText" TEXT NOT NULL,
    "leadTimeLabel" TEXT NOT NULL,
    "primaryInquiryType" TEXT NOT NULL,
    "briefingSourceType" TEXT NOT NULL,
    "linkedProductId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyCurationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialContent" (
    "id" TEXT NOT NULL,
    "pageScope" TEXT NOT NULL DEFAULT 'overseas',
    "regionKey" TEXT,
    "countryCode" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "bodyKr" TEXT NOT NULL,
    "heroImageUrl" TEXT,
    "heroImageAlt" TEXT,
    "heroImageStorageKey" TEXT,
    "heroImageWidth" INTEGER,
    "heroImageHeight" INTEGER,
    "sourceType" TEXT,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "slug" TEXT,
    "privateTripHeroSlot" BOOLEAN NOT NULL DEFAULT false,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "cardTags" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorialContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyCurationContent" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "pageScope" TEXT NOT NULL DEFAULT 'overseas',
    "regionKey" TEXT,
    "countryCode" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "bodyKr" TEXT NOT NULL,
    "ctaLabel" TEXT,
    "linkedProductId" TEXT,
    "linkedHref" TEXT,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "imageStorageKey" TEXT,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "sourceType" TEXT,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "slug" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyCurationContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerInquiry" (
    "id" TEXT NOT NULL,
    "inquiryType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "leadTimeRisk" TEXT NOT NULL DEFAULT 'normal',
    "applicantName" TEXT NOT NULL,
    "applicantPhone" TEXT NOT NULL,
    "applicantEmail" TEXT,
    "message" TEXT,
    "productId" TEXT,
    "monthlyCurationItemId" TEXT,
    "snapshotProductTitle" TEXT,
    "snapshotCardLabel" TEXT,
    "routingReasonJson" TEXT,
    "sourcePagePath" TEXT,
    "privacyAgreed" BOOLEAN NOT NULL DEFAULT false,
    "privacyNoticeConfirmedAt" TIMESTAMP(3),
    "privacyNoticeVersion" TEXT,
    "preferredContactChannel" TEXT,
    "selectedServiceType" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "emailSentStatus" TEXT,
    "emailError" TEXT,
    "payloadJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_assets" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_name_kr" TEXT NOT NULL,
    "entity_name_en" TEXT,
    "supplier_name" TEXT,
    "service_type" TEXT NOT NULL,
    "image_role" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_ext" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "storage_bucket" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "public_url" TEXT NOT NULL,
    "alt_kr" TEXT NOT NULL,
    "alt_en" TEXT NOT NULL,
    "title_kr" TEXT,
    "title_en" TEXT,
    "source_type" TEXT NOT NULL,
    "source_name" TEXT,
    "source_note" TEXT,
    "is_generated" BOOLEAN,
    "seo_title_kr" TEXT,
    "seo_title_en" TEXT,
    "upload_status" TEXT NOT NULL,
    "uploaded_by" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sheet_sync_status" TEXT,
    "sheet_sync_error" TEXT,
    "sheet_synced_at" TIMESTAMP(3),

    CONSTRAINT "image_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'overseas',
    "review_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "body" TEXT,
    "customer_type" TEXT,
    "destination_country" TEXT,
    "destination_city" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "travel_month" DATE,
    "displayed_date" DATE,
    "rating_label" TEXT,
    "thumbnail_url" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejection_reason" TEXT,
    "source_type" TEXT NOT NULL DEFAULT 'customer_submitted',
    "approved_at" TIMESTAMPTZ(6),
    "approved_by" UUID,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "travel_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegisterAdminInputSnapshot" (
    "id" TEXT NOT NULL,
    "brandKey" TEXT,
    "originSource" TEXT NOT NULL,
    "originUrl" TEXT,
    "originCode" TEXT,
    "bodyText" TEXT NOT NULL,
    "pastedBlocksJson" TEXT,
    "inputDigest" TEXT NOT NULL,
    "travelScope" TEXT,
    "requestMode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'raw_saved',
    "retentionExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegisterAdminInputSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegisterAdminAnalysis" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'analysis_running',
    "llmFinishReason" TEXT,
    "repairAttempted" BOOLEAN NOT NULL DEFAULT false,
    "repairFinishReason" TEXT,
    "parseErrorMessage" TEXT,
    "llmRawFirstPass" TEXT,
    "llmRawRepair" TEXT,
    "parsedJson" TEXT,
    "normalizedJson" TEXT,
    "extractionIssuesJson" TEXT,
    "reviewState" TEXT,
    "originCodeResolved" TEXT,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegisterAdminAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_originSource_originCode_key" ON "Product"("originSource", "originCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPrice_productId_date_key" ON "ProductPrice"("productId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ItineraryDay_productId_day_key" ON "ItineraryDay"("productId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "ProductDeparture_productId_departureDate_key" ON "ProductDeparture"("productId", "departureDate");

-- CreateIndex
CREATE UNIQUE INDEX "HanatourMonthlyBenefit_supplierKey_benefitMonth_key" ON "HanatourMonthlyBenefit"("supplierKey", "benefitMonth");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Destination_name_key" ON "Destination"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DestinationGalleryCache_destinationName_key" ON "DestinationGalleryCache"("destinationName");

-- CreateIndex
CREATE UNIQUE INDEX "DestinationImageSet_destinationName_key" ON "DestinationImageSet"("destinationName");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoPool_filePath_key" ON "PhotoPool"("filePath");

-- CreateIndex
CREATE INDEX "AssetUsageLog_productId_day_usedAt_idx" ON "AssetUsageLog"("productId", "day", "usedAt");

-- CreateIndex
CREATE INDEX "AssetUsageLog_assetId_usedAt_idx" ON "AssetUsageLog"("assetId", "usedAt");

-- CreateIndex
CREATE INDEX "AssetUsageLog_assetPath_usedAt_idx" ON "AssetUsageLog"("assetPath", "usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_brandKey_key" ON "Brand"("brandKey");

-- CreateIndex
CREATE INDEX "MonthlyCurationItem_yearMonth_scope_status_isActive_idx" ON "MonthlyCurationItem"("yearMonth", "scope", "status", "isActive");

-- CreateIndex
CREATE INDEX "MonthlyCurationItem_linkedProductId_idx" ON "MonthlyCurationItem"("linkedProductId");

-- CreateIndex
CREATE INDEX "EditorialContent_pageScope_isPublished_sortOrder_idx" ON "EditorialContent"("pageScope", "isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "EditorialContent_regionKey_idx" ON "EditorialContent"("regionKey");

-- CreateIndex
CREATE INDEX "EditorialContent_countryCode_idx" ON "EditorialContent"("countryCode");

-- CreateIndex
CREATE INDEX "MonthlyCurationContent_pageScope_monthKey_isPublished_sortO_idx" ON "MonthlyCurationContent"("pageScope", "monthKey", "isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "MonthlyCurationContent_regionKey_idx" ON "MonthlyCurationContent"("regionKey");

-- CreateIndex
CREATE INDEX "MonthlyCurationContent_countryCode_idx" ON "MonthlyCurationContent"("countryCode");

-- CreateIndex
CREATE INDEX "MonthlyCurationContent_linkedProductId_idx" ON "MonthlyCurationContent"("linkedProductId");

-- CreateIndex
CREATE INDEX "CustomerInquiry_inquiryType_idx" ON "CustomerInquiry"("inquiryType");

-- CreateIndex
CREATE INDEX "CustomerInquiry_status_idx" ON "CustomerInquiry"("status");

-- CreateIndex
CREATE INDEX "CustomerInquiry_leadTimeRisk_idx" ON "CustomerInquiry"("leadTimeRisk");

-- CreateIndex
CREATE INDEX "CustomerInquiry_createdAt_idx" ON "CustomerInquiry"("createdAt");

-- CreateIndex
CREATE INDEX "CustomerInquiry_productId_idx" ON "CustomerInquiry"("productId");

-- CreateIndex
CREATE INDEX "CustomerInquiry_monthlyCurationItemId_idx" ON "CustomerInquiry"("monthlyCurationItemId");

-- CreateIndex
CREATE INDEX "image_assets_entity_type_entity_id_image_role_idx" ON "image_assets"("entity_type", "entity_id", "image_role");

-- CreateIndex
CREATE INDEX "image_assets_public_url_idx" ON "image_assets"("public_url");

-- CreateIndex
CREATE INDEX "idx_travel_reviews_created_at" ON "travel_reviews"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_travel_reviews_display_order" ON "travel_reviews"("display_order");

-- CreateIndex
CREATE INDEX "idx_travel_reviews_displayed_date" ON "travel_reviews"("displayed_date" DESC);

-- CreateIndex
CREATE INDEX "idx_travel_reviews_review_type" ON "travel_reviews"("review_type");

-- CreateIndex
CREATE INDEX "idx_travel_reviews_status_category_featured" ON "travel_reviews"("status", "category", "is_featured");

-- CreateIndex
CREATE INDEX "idx_travel_reviews_user_id" ON "travel_reviews"("user_id");

-- CreateIndex
CREATE INDEX "RegisterAdminInputSnapshot_inputDigest_idx" ON "RegisterAdminInputSnapshot"("inputDigest");

-- CreateIndex
CREATE INDEX "RegisterAdminInputSnapshot_status_createdAt_idx" ON "RegisterAdminInputSnapshot"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RegisterAdminInputSnapshot_retentionExpiresAt_idx" ON "RegisterAdminInputSnapshot"("retentionExpiresAt");

-- CreateIndex
CREATE INDEX "RegisterAdminAnalysis_snapshotId_attemptNo_idx" ON "RegisterAdminAnalysis"("snapshotId", "attemptNo");

-- CreateIndex
CREATE INDEX "RegisterAdminAnalysis_status_idx" ON "RegisterAdminAnalysis"("status");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionalTour" ADD CONSTRAINT "OptionalTour_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Itinerary" ADD CONSTRAINT "Itinerary_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryDay" ADD CONSTRAINT "ItineraryDay_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDeparture" ADD CONSTRAINT "ProductDeparture_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetUsageLog" ADD CONSTRAINT "AssetUsageLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyCurationItem" ADD CONSTRAINT "MonthlyCurationItem_linkedProductId_fkey" FOREIGN KEY ("linkedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInquiry" ADD CONSTRAINT "CustomerInquiry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInquiry" ADD CONSTRAINT "CustomerInquiry_monthlyCurationItemId_fkey" FOREIGN KEY ("monthlyCurationItemId") REFERENCES "MonthlyCurationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterAdminAnalysis" ADD CONSTRAINT "RegisterAdminAnalysis_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RegisterAdminInputSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

