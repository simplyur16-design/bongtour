-- 트랙 ⑥ 상품 노출·판매 정책 — 마커 컬럼 + 인덱스 SSOT.
--
-- 룰 A (향후 90일 미래 출발 0건 → 판매 중지 분류):
--   Product.noFutureDepartureConfirmedAt — `runOneSalesPolicyCheck` 가 라이브 fetch 결과 0건이면 NOW() 기록.
--   1건이라도 발견 시 NULL 로 초기화. `registrationStatus` 자동 변경 X (어드민 SSOT 유지).
--
-- 룰 B (마지막 미래 출발일 D-7 이내 → 노출 cutoff):
--   Product.lastFutureDepartureDate — 라이브 fetch 결과 중 미래 출발일의 MAX. 향후 미래 출발일 없으면 NULL.
--   8 노출 경로 prisma where 에서 `noFutureDepartureConfirmedAt IS NULL OR lastFutureDepartureDate >= NOW() + 7d` 로 cutoff.
--
-- 정렬 SSOT (`pickNextProductToCheck`):
--   Product.lastSalesPolicyCheckedAt — 매 trigger 마다 NOW() 기록. NULL 우선 + ASC 순환.
--   @@index([lastSalesPolicyCheckedAt]) — 5분 cron + Product ~110건 풀스캔 부담 완화.
--
-- 멀티 인스턴스 안전 (Postgres ALTER + CREATE INDEX 모두 IF NOT EXISTS).
-- 마이그 부담: ALTER 1건 (3 컬럼 동시) + CREATE INDEX 1건. 기존 행 정렬 NULL → 첫 cron 사이클로 자연 채워짐.
-- `lastFutureDepartureDate` 인덱스는 운영 측정 후 추가 (메모리 #11 정합).

-- 1) Product: 마커 컬럼 3종 신규 (NULLABLE — 첫 갱신 전까지 정책 미적용 = 기존 동작)
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "noFutureDepartureConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastSalesPolicyCheckedAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastFutureDepartureDate"      TIMESTAMP(3);

-- 2) `pickNextProductToCheck` 정렬 인덱스 (NULL 우선 + ASC 효율)
CREATE INDEX IF NOT EXISTS "Product_lastSalesPolicyCheckedAt_idx"
  ON "Product"("lastSalesPolicyCheckedAt");
