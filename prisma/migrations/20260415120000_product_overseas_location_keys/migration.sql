-- Product: 해외 목적지 트리 SSOT 보조 키(매칭 실패 시 null)
ALTER TABLE "Product" ADD COLUMN "countryKey" TEXT;
ALTER TABLE "Product" ADD COLUMN "nodeKey" TEXT;
ALTER TABLE "Product" ADD COLUMN "groupKey" TEXT;
ALTER TABLE "Product" ADD COLUMN "locationMatchConfidence" TEXT;
ALTER TABLE "Product" ADD COLUMN "locationMatchSource" TEXT;
