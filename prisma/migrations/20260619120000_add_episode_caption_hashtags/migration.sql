-- AlterTable
ALTER TABLE "BongCardNewsEpisode"
  ADD COLUMN "caption" TEXT,
  ADD COLUMN "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[];
