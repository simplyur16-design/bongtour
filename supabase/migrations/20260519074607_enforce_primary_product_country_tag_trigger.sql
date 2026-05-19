-- 원초적 해결: application 코드(syncProductCountryTags) 의존 폐기.
-- DB 레벨에서 registered Product → primary ProductCountryTag 1행 강제.
-- 적용: Supabase MCP (Claude가 직접 운영 적용 완료, version=20260519074607)

-- 1) (productId, countryKey) 고유 제약 — 중복 영구 차단 + ON CONFLICT 가능
ALTER TABLE "ProductCountryTag"
ADD CONSTRAINT "ProductCountryTag_productId_countryKey_unique"
UNIQUE ("productId", "countryKey");

-- 2) 트리거 함수: registered + countryKey 정합이면 primary 1행 보장
CREATE OR REPLACE FUNCTION sync_primary_product_country_tag()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."registrationStatus" IS DISTINCT FROM 'registered' THEN
    RETURN NEW;
  END IF;
  
  IF NEW."countryKey" IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM "Country" WHERE "countryKey" = NEW."countryKey") THEN
    RETURN NEW;
  END IF;
  
  UPDATE "ProductCountryTag"
  SET "isPrimary" = false
  WHERE "productId" = NEW."id"
    AND "countryKey" != NEW."countryKey"
    AND "isPrimary" = true;
  
  INSERT INTO "ProductCountryTag" ("id", "productId", "countryKey", "isPrimary", "sortOrder", "createdAt")
  VALUES (gen_random_uuid()::text, NEW."id", NEW."countryKey", true, 0, NOW())
  ON CONFLICT ("productId", "countryKey")
  DO UPDATE SET "isPrimary" = true, "sortOrder" = 0;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) 트리거: Product INSERT 또는 registrationStatus·countryKey UPDATE 시 발동
DROP TRIGGER IF EXISTS trg_sync_primary_product_country_tag ON "Product";
CREATE TRIGGER trg_sync_primary_product_country_tag
AFTER INSERT OR UPDATE OF "registrationStatus", "countryKey" ON "Product"
FOR EACH ROW
EXECUTE FUNCTION sync_primary_product_country_tag();

-- 4) 기존 미시드 상품 일회성 보강 (트리거는 신규 변경에만 발동)
INSERT INTO "ProductCountryTag" ("id", "productId", "countryKey", "isPrimary", "sortOrder", "createdAt")
SELECT 
  gen_random_uuid()::text,
  p."id",
  p."countryKey",
  true,
  0,
  NOW()
FROM "Product" p
WHERE p."registrationStatus" = 'registered'
  AND p."countryKey" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "Country" WHERE "countryKey" = p."countryKey")
  AND NOT EXISTS (
    SELECT 1 FROM "ProductCountryTag" 
    WHERE "productId" = p."id" AND "countryKey" = p."countryKey"
  )
ON CONFLICT ("productId", "countryKey") DO NOTHING;
