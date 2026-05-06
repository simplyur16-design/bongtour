-- H-2: 해외 목적지 DB 마스터 (운영 H-1과 동일 DDL이면 IF NOT EXISTS로 no-op)
-- Supabase: schema_migrations에 기록 후 적용

CREATE TABLE IF NOT EXISTS "OverseasGroup" (
    "groupKey" TEXT NOT NULL,
    "koreanLabel" TEXT NOT NULL,
    "continent" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OverseasGroup_pkey" PRIMARY KEY ("groupKey")
);

CREATE TABLE IF NOT EXISTS "OverseasCountry" (
    "countryKey" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "koreanLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OverseasCountry_pkey" PRIMARY KEY ("countryKey")
);

CREATE INDEX IF NOT EXISTS "OverseasCountry_groupKey_idx" ON "OverseasCountry"("groupKey");

ALTER TABLE "OverseasCountry" DROP CONSTRAINT IF EXISTS "OverseasCountry_groupKey_fkey";
ALTER TABLE "OverseasCountry" ADD CONSTRAINT "OverseasCountry_groupKey_fkey"
  FOREIGN KEY ("groupKey") REFERENCES "OverseasGroup"("groupKey") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "OverseasNode" (
    "nodeKey" TEXT NOT NULL,
    "countryKey" TEXT NOT NULL,
    "koreanLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OverseasNode_pkey" PRIMARY KEY ("nodeKey")
);

CREATE INDEX IF NOT EXISTS "OverseasNode_countryKey_idx" ON "OverseasNode"("countryKey");

ALTER TABLE "OverseasNode" DROP CONSTRAINT IF EXISTS "OverseasNode_countryKey_fkey";
ALTER TABLE "OverseasNode" ADD CONSTRAINT "OverseasNode_countryKey_fkey"
  FOREIGN KEY ("countryKey") REFERENCES "OverseasCountry"("countryKey") ON DELETE RESTRICT ON UPDATE CASCADE;
