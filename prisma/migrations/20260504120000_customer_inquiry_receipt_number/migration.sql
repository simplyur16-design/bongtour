-- CustomerInquiry: 인쇄·표시용 접수번호 (BT{YYMMDD}-{NNNN}). PK id(cuid) 유지.
-- 적용 순서: 컬럼 추가 → 기존 행 백필 → 유니크 인덱스

ALTER TABLE "CustomerInquiry" ADD COLUMN "receiptNumber" TEXT;

-- 같은 달력일( DB 세션 타임존 기준 DATE(createdAt) ) 내 createdAt 오름차순으로 0001부터 부여
WITH numbered AS (
  SELECT
    id,
    'BT' || TO_CHAR("createdAt", 'YYMMDD') || '-' || LPAD(
      ROW_NUMBER() OVER (PARTITION BY DATE("createdAt") ORDER BY "createdAt")::text,
      4,
      '0'
    ) AS receipt
  FROM "CustomerInquiry"
  WHERE "receiptNumber" IS NULL
)
UPDATE "CustomerInquiry" AS cu
SET "receiptNumber" = n.receipt
FROM numbered AS n
WHERE cu.id = n.id;

CREATE UNIQUE INDEX "CustomerInquiry_receiptNumber_key" ON "CustomerInquiry" ("receiptNumber");
