/**
 * 상품 목록 수집(야간 Playwright ingest) 게이트.
 * 기본 OFF — 가격 sweep·대기열 힐과 분리. 다시 켤 때 ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST=1
 * REGRESSION-FREEZE[register-listing-ingest-opt-in]: listing ingest default off — manifest
 */
import {
  resolveInstrumentationProcessRole,
  type InstrumentationProcessRole,
} from '@/lib/instrumentation-process-role'

/**
 * 야간 총량 기본 상한 — `REGISTER_PRE_PHOTO_INGEST_OPERATOR_NIGHT_TOTAL`(4사×3=12)과 동일.
 * FREEZE 숫자는 night-window 쪽을 건드리지 않는다.
 */
const REGISTER_INGEST_NIGHT_MAX_TOTAL_DEFAULT = 12

export function isRegisterListingIngestCronEnabled(): boolean {
  return process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST === '1'
}

/**
 * 등록대기 키워드·일정 셀프힐 cron (수집과 무관).
 * 기본 ON. 끌 때 DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON=1
 * REGRESSION-FREEZE[register-pre-photo-heal-cron-always]: ingest off여도 heal cron 유지 — manifest
 */
export function isRegisterPrePhotoHealOnlyCronEnabled(): boolean {
  return process.env.DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON !== '1'
}

/**
 * 야간 수집 cron을 이 프로세스에 등록해도 되는지 (역할).
 * web 기본 금지 — eSIM 문자 drain 과 분리. REGISTER_INGEST_ALLOW_ON_WEB=1 만 예외.
 * ENABLE 게이트와 독립 — 호출부에서 isRegisterListingIngestCronEnabled 를 먼저 본다.
 */
export function isRegisterListingIngestAllowedInThisProcess(
  role: InstrumentationProcessRole = resolveInstrumentationProcessRole(),
): boolean {
  if (role === 'worker' || role === 'all') return true
  return process.env.REGISTER_INGEST_ALLOW_ON_WEB === '1'
}

/** ENABLE + 프로세스 역할이 모두 통과할 때만 night ingest cron 등록 */
export function shouldRegisterRegisterListingIngestNightCron(
  role: InstrumentationProcessRole = resolveInstrumentationProcessRole(),
): boolean {
  return isRegisterListingIngestCronEnabled() && isRegisterListingIngestAllowedInThisProcess(role)
}

/**
 * 야간 수집 총량 상한. 기본 = OPERATOR_NIGHT_TOTAL, 그보다 크게는 못 올림.
 * FREEZE 숫자(OPERATOR_NIGHT_TOTAL)는 바꾸지 않는다.
 */
export function registerIngestNightMaxTotal(): number {
  const base = REGISTER_INGEST_NIGHT_MAX_TOTAL_DEFAULT
  const raw = process.env.REGISTER_INGEST_NIGHT_MAX_TOTAL
  if (raw == null || String(raw).trim() === '') return base
  const n = Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || Number.isNaN(n) || n < 0) return base
  return Math.min(n, base)
}

/** eSIM 양보로 건너뛴 tick 수 (프로세스 메모리, 다이제스트용) */
let ingestYieldSkipCount = 0

export function getRegisterIngestEsimYieldSkipCount(): number {
  return ingestYieldSkipCount
}

export function __resetRegisterIngestEsimYieldSkipCountForTest(): void {
  ingestYieldSkipCount = 0
}

function recordYieldSkip(): void {
  ingestYieldSkipCount += 1
}

/**
 * eSIM QR 문자 대기 중이면 수집 tick 양보.
 * REGISTER_INGEST_YIELD_TO_ESIM=0 이면 끔(기본 켬). 쿼리 실패 시 안전하게 건너뜀.
 */
export async function registerIngestShouldYieldToEsimSms(): Promise<{
  skip: boolean
  pending: number
}> {
  if (process.env.REGISTER_INGEST_YIELD_TO_ESIM === '0') {
    return { skip: false, pending: 0 }
  }
  try {
    const { countPendingEsimQrNotify } = await import(
      '@/lib/bongsim/fulfillment/esim-qr-notify-outbox'
    )
    const pending = await countPendingEsimQrNotify()
    if (pending > 0) {
      recordYieldSkip()
      return { skip: true, pending }
    }
    return { skip: false, pending: 0 }
  } catch {
    recordYieldSkip()
    return { skip: true, pending: -1 }
  }
}
