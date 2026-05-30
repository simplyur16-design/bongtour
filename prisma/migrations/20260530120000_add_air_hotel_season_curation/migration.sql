-- CreateTable
CREATE TABLE "AirHotelSeasonCuration" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "cycleStartDate" TIMESTAMP(3) NOT NULL,
    "seasonMessage" TEXT NOT NULL,
    "heroImageUrl" TEXT,
    "linkedProductIds" JSONB NOT NULL,
    "geminiPrompt" TEXT,
    "geminiResponse" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AirHotelSeasonCuration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AirHotelSeasonCuration_cycleId_key" ON "AirHotelSeasonCuration"("cycleId");

-- CreateIndex
CREATE INDEX "AirHotelSeasonCuration_cycleStartDate_idx" ON "AirHotelSeasonCuration"("cycleStartDate");
