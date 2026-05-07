-- D-5: 공급사 핵심 포인트(raw + 운영 정리본)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "highlightPointsRaw" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "highlightPoints" TEXT;
