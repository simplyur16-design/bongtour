-- B' on-demand 가격 자동 백필 — 봇 차단 회피용 다층 가드 (G1 ~ G5) 영속 SSOT.
--
-- G1 (per-departure 30분 쿨다운): ProductDeparture.lastScrapeAttemptAt
--   주기 수집(syncedAt) 과 의미 분리 — 사용자 액션으로 트리거된 라이브 스크래핑 시도만 기록.
-- G2/G5 (per-supplier 5~12s throttle + 마지막 시작/완료 시각):
--   ScraperSupplierState — 행 1개당 1 공급사 (정규화 키 PK, 총 5행: hanatour/modetour/verygoodtour/ybtour/lottetour).
--   cron 배치도 같은 테이블에 lastFinishedAt 갱신 → on-demand 인터벌 정합 (Q2 정책).
--
-- 멀티 인스턴스 안전 (Postgres upsert). 마이그 부담: ALTER 1건 + CREATE 1건.

-- 1) ProductDeparture: lastScrapeAttemptAt 컬럼 신규 (NULLABLE, 기본값 없음 — 첫 시도 시 NULL → 쿨다운 미적용)
ALTER TABLE "ProductDeparture"
  ADD COLUMN IF NOT EXISTS "lastScrapeAttemptAt" TIMESTAMP(3);

-- 2) ScraperSupplierState: 공급사별 마지막 시작/완료 시각 SSOT
CREATE TABLE IF NOT EXISTS "ScraperSupplierState" (
  "supplierKey"    TEXT         NOT NULL,
  "lastStartedAt"  TIMESTAMP(3),
  "lastFinishedAt" TIMESTAMP(3),
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScraperSupplierState_pkey" PRIMARY KEY ("supplierKey")
);
