-- CreateTable
CREATE TABLE "MonthlyCurationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonthlyCurationItem_linkedProductId_fkey" FOREIGN KEY ("linkedProductId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerInquiry" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "payloadJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerInquiry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomerInquiry_monthlyCurationItemId_fkey" FOREIGN KEY ("monthlyCurationItemId") REFERENCES "MonthlyCurationItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MonthlyCurationItem_yearMonth_scope_status_isActive_idx" ON "MonthlyCurationItem"("yearMonth", "scope", "status", "isActive");

-- CreateIndex
CREATE INDEX "MonthlyCurationItem_linkedProductId_idx" ON "MonthlyCurationItem"("linkedProductId");

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
