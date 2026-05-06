-- I-3-A: Product → Continent / City 마스터 FK (ON DELETE RESTRICT)
ALTER TABLE "Product" ADD COLUMN "continentKey" TEXT;
ALTER TABLE "Product" ADD COLUMN "cityKey" TEXT;

CREATE INDEX "Product_continentKey_idx" ON "Product"("continentKey");
CREATE INDEX "Product_cityKey_idx" ON "Product"("cityKey");

ALTER TABLE "Product" ADD CONSTRAINT "Product_continentKey_fkey"
  FOREIGN KEY ("continentKey") REFERENCES "Continent"("continentKey")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Product" ADD CONSTRAINT "Product_cityKey_fkey"
  FOREIGN KEY ("cityKey") REFERENCES "City"("cityKey")
  ON DELETE RESTRICT ON UPDATE CASCADE;
