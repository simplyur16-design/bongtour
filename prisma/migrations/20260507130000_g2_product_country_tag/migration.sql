-- G-2: ProductCountryTag M:N (다국가 표현 옵션 C — 보조 태그만 추가, Product 행·컬럼 변경 없음)
-- 운영 적용: 사용자 승인 후 Supabase MCP apply_migration 등으로 본 파일 실행

CREATE TABLE "ProductCountryTag" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "countryKey" TEXT NOT NULL,
    "nodeKey" TEXT,
    "groupKey" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCountryTag_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductCountryTag_productId_idx" ON "ProductCountryTag"("productId");

CREATE INDEX "ProductCountryTag_countryKey_nodeKey_idx" ON "ProductCountryTag"("countryKey", "nodeKey");

CREATE INDEX "ProductCountryTag_groupKey_idx" ON "ProductCountryTag"("groupKey");

ALTER TABLE "ProductCountryTag" ADD CONSTRAINT "ProductCountryTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique (productId, countryKey, COALESCE(nodeKey,'')) 생략:
-- Prisma @@unique 미사용과 정합; NULL nodeKey 중복은 G-4 어드민·앱 레벨에서 방지.
