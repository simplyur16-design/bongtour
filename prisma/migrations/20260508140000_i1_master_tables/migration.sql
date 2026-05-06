-- I-1: 봉투어 지리 SSOT 마스터 (Continent / Country / City / 메가메뉴 그룹 카드 / ProductCityTag)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "Continent" (
    "continentKey" TEXT NOT NULL,
    "koreanLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Continent_pkey" PRIMARY KEY ("continentKey")
);

CREATE TABLE "Country" (
    "countryKey" TEXT NOT NULL,
    "continentKey" TEXT NOT NULL,
    "koreanLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("countryKey")
);

CREATE INDEX "Country_continentKey_idx" ON "Country"("continentKey");

ALTER TABLE "Country" ADD CONSTRAINT "Country_continentKey_fkey" FOREIGN KEY ("continentKey") REFERENCES "Continent"("continentKey") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "City" (
    "cityKey" TEXT NOT NULL,
    "countryKey" TEXT NOT NULL,
    "koreanLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isMajor" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "City_pkey" PRIMARY KEY ("cityKey")
);

CREATE INDEX "City_countryKey_idx" ON "City"("countryKey");

ALTER TABLE "City" ADD CONSTRAINT "City_countryKey_fkey" FOREIGN KEY ("countryKey") REFERENCES "Country"("countryKey") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MegaMenuGroupCard" (
    "cardKey" TEXT NOT NULL,
    "koreanLabel" TEXT NOT NULL,
    "continentKey" TEXT NOT NULL,
    "displayMode" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MegaMenuGroupCard_pkey" PRIMARY KEY ("cardKey")
);

CREATE INDEX "MegaMenuGroupCard_continentKey_idx" ON "MegaMenuGroupCard"("continentKey");

ALTER TABLE "MegaMenuGroupCard" ADD CONSTRAINT "MegaMenuGroupCard_continentKey_fkey" FOREIGN KEY ("continentKey") REFERENCES "Continent"("continentKey") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MegaMenuGroupCardCountry" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "cardKey" TEXT NOT NULL,
    "countryKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MegaMenuGroupCardCountry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MegaMenuGroupCardCountry" ADD CONSTRAINT "MegaMenuGroupCardCountry_cardKey_fkey" FOREIGN KEY ("cardKey") REFERENCES "MegaMenuGroupCard"("cardKey") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MegaMenuGroupCardCountry" ADD CONSTRAINT "MegaMenuGroupCardCountry_countryKey_fkey" FOREIGN KEY ("countryKey") REFERENCES "Country"("countryKey") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "MegaMenuGroupCardCountry_cardKey_countryKey_key" ON "MegaMenuGroupCardCountry"("cardKey", "countryKey");

CREATE TABLE "MegaMenuGroupCardCity" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "cardKey" TEXT NOT NULL,
    "cityKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MegaMenuGroupCardCity_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MegaMenuGroupCardCity" ADD CONSTRAINT "MegaMenuGroupCardCity_cardKey_fkey" FOREIGN KEY ("cardKey") REFERENCES "MegaMenuGroupCard"("cardKey") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MegaMenuGroupCardCity" ADD CONSTRAINT "MegaMenuGroupCardCity_cityKey_fkey" FOREIGN KEY ("cityKey") REFERENCES "City"("cityKey") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "MegaMenuGroupCardCity_cardKey_cityKey_key" ON "MegaMenuGroupCardCity"("cardKey", "cityKey");

CREATE TABLE "ProductCityTag" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "productId" TEXT NOT NULL,
    "cityKey" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCityTag_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductCityTag_productId_idx" ON "ProductCityTag"("productId");
CREATE INDEX "ProductCityTag_cityKey_idx" ON "ProductCityTag"("cityKey");

ALTER TABLE "ProductCityTag" ADD CONSTRAINT "ProductCityTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductCountryTag" DROP CONSTRAINT IF EXISTS "ProductCountryTag_countryKey_fkey";
ALTER TABLE "ProductCountryTag" ADD CONSTRAINT "ProductCountryTag_countryKey_fkey" FOREIGN KEY ("countryKey") REFERENCES "Country"("countryKey") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (Supabase 표준: service_role 전체, anon 읽기)
ALTER TABLE "Continent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Country" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "City" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MegaMenuGroupCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MegaMenuGroupCardCountry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MegaMenuGroupCardCity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductCityTag" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Continent_service_role_all" ON "Continent" FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Continent_anon_select" ON "Continent" FOR SELECT TO anon USING (true);

CREATE POLICY "Country_service_role_all" ON "Country" FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Country_anon_select" ON "Country" FOR SELECT TO anon USING (true);

CREATE POLICY "City_service_role_all" ON "City" FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "City_anon_select" ON "City" FOR SELECT TO anon USING (true);

CREATE POLICY "MegaMenuGroupCard_service_role_all" ON "MegaMenuGroupCard" FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "MegaMenuGroupCard_anon_select" ON "MegaMenuGroupCard" FOR SELECT TO anon USING (true);

CREATE POLICY "MegaMenuGroupCardCountry_service_role_all" ON "MegaMenuGroupCardCountry" FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "MegaMenuGroupCardCountry_anon_select" ON "MegaMenuGroupCardCountry" FOR SELECT TO anon USING (true);

CREATE POLICY "MegaMenuGroupCardCity_service_role_all" ON "MegaMenuGroupCardCity" FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "MegaMenuGroupCardCity_anon_select" ON "MegaMenuGroupCardCity" FOR SELECT TO anon USING (true);

CREATE POLICY "ProductCityTag_service_role_all" ON "ProductCityTag" FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "ProductCityTag_anon_select" ON "ProductCityTag" FOR SELECT TO anon USING (true);
