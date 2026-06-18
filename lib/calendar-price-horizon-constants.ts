/**
 * 달력·출발일 가격 수집 지평선 상수 — leaf module (Node `fs`·순환 import 없음, 클라이언트 번들 안전).
 *
 * REGRESSION-FREEZE[calendar-price-horizon-180d]: 180일·6개월 하한 — manifest
 *
 * re-export SSOT: `lib/calendar-price-horizon.ts` · 배치 `CALENDAR_BATCH_HORIZON_DAYS`
 */
export const CALENDAR_PRICE_HORIZON_DAYS = 180

/** 배치 sequential·검증과 동일한 180일 — `calendar-batch-seq-state`에서 re-export */
export const CALENDAR_BATCH_HORIZON_DAYS = CALENDAR_PRICE_HORIZON_DAYS

/** E2E 달력 월 루프 상한 — 180일(≈6개월) 커버 */
export const CALENDAR_PRICE_HORIZON_MONTHS_FORWARD = 6
