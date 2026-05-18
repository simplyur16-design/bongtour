-- Product 공개 URL 슬러그 (pkg-mt-0001 형식). 백필 전 null 허용.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Product_slug_key" ON "Product" ("slug") WHERE "slug" IS NOT NULL;
