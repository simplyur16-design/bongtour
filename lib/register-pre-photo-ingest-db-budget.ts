/**
 * 야간 listing ingest / 대량 heal 이 Supabase 풀·eSIM·홈 HTTP 와 경합하지 않도록 DB 예산 SSOT.
 * web(Prisma 3 + bongsim catalog/outbox) 여유를 남기고 worker 배치만 줄인다.
 * REGRESSION-FREEZE[register-pre-photo-ingest-db-budget]: night ingest heal 상한·probe off — manifest
 */

/** 야간 ingest 틱 직후 heal — 신규 소수 + 짧은 대기열만 (기본 heal 200 금지) */
export const REGISTER_PRE_PHOTO_INGEST_NIGHT_HEAL_LIMIT = 24

/** heal-only cron 기본 상한 — 주간에도 한 틱에 풀을 비우지 않음 */
export const REGISTER_PRE_PHOTO_HEAL_ONLY_LIMIT = 80

/** 상품 간 짧은 양보(ms) — 연속 updateMany 가 session/transaction 슬롯을 잠식하지 않게 */
export const REGISTER_PRE_PHOTO_HEAL_YIELD_MS = 40

/** itineraryDay 동기화 일 수 상한 — N일×M상품 쿼리 폭주 방지 */
export const REGISTER_PRE_PHOTO_HEAL_ITINERARY_DAY_CAP = 12

export function registerPrePhotoIngestNightHealOpts(): {
  probeImageUrls: false
  healLimit: number
} {
  return {
    // HEAD probe 는 외부 HTTP + 추가 DB 쓰기 — 야간 수집과 겹치지 않음
    probeImageUrls: false,
    healLimit: REGISTER_PRE_PHOTO_INGEST_NIGHT_HEAL_LIMIT,
  }
}

export function registerPrePhotoHealOnlyOpts(): {
  skipIngest: true
  probeImageUrls: boolean
  healLimit: number
} {
  return {
    skipIngest: true,
    // 주간 heal-only 만 URL probe (수집 틱과 분리)
    probeImageUrls: true,
    healLimit: REGISTER_PRE_PHOTO_HEAL_ONLY_LIMIT,
  }
}

export async function yieldRegisterPrePhotoHealBudget(): Promise<void> {
  await new Promise((r) => setTimeout(r, REGISTER_PRE_PHOTO_HEAL_YIELD_MS))
}
