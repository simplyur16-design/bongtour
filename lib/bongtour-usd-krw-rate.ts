/**
 * 관리자 OTA 인보이스/바우처용 USD→KRW (결제당일 환율 우선).
 * REGRESSION-FREEZE[admin-ota-receipt-invoice]: OTA 영수증→회사 인보이스 — manifest
 */

import { getSimplyurFxRates } from '@/lib/simplyur/currency'
import { isSimplyurFxRateInBand } from '@/lib/simplyur/fx-rates'

export type BongtourUsdKrwRateResult = {
  rateDate: string
  /** 실제 고시일 (주말·휴일 롤백 등) */
  effectiveDate: string
  usdKrw: number
  source: 'frankfurter' | 'exchangerate_api_latest' | 'env_fallback'
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

/** Asia/Seoul 기준 YYYY-MM-DD */
export function seoulYmd(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function assertYmd(ymd: string): string {
  const s = String(ymd || '').trim()
  if (!YMD_RE.test(s)) throw new Error('rateDate must be YYYY-MM-DD')
  return s
}

export function usdAmountToKrw(usd: number, usdKrwRate: number): number {
  const u = Number(usd)
  const r = Number(usdKrwRate)
  if (!Number.isFinite(u) || u < 0) return 0
  if (!Number.isFinite(r) || r <= 0) return 0
  return Math.round(u * r)
}

type FrankfurterPayload = {
  amount?: number
  base?: string
  date?: string
  rates?: Record<string, number>
}

export function parseFrankfurterUsdKrw(payload: FrankfurterPayload): { usdKrw: number; effectiveDate: string } | null {
  if (!payload || payload.base !== 'USD') return null
  const usdKrw = Number(payload.rates?.KRW)
  if (!Number.isFinite(usdKrw) || usdKrw <= 0) return null
  if (!isSimplyurFxRateInBand('USD', usdKrw)) return null
  const effectiveDate = typeof payload.date === 'string' && YMD_RE.test(payload.date) ? payload.date : ''
  if (!effectiveDate) return null
  return { usdKrw, effectiveDate }
}

async function fetchFrankfurterUsdKrw(
  ymd: string,
  fetchImpl: typeof fetch,
): Promise<{ usdKrw: number; effectiveDate: string } | null> {
  const url = `https://api.frankfurter.app/${encodeURIComponent(ymd)}?from=USD&to=KRW`
  const res = await fetchImpl(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) return null
  const json = (await res.json()) as FrankfurterPayload
  return parseFrankfurterUsdKrw(json)
}

function readExchangeRateApiKey(): string | null {
  const key =
    (process.env.SIMPLYUR_EXCHANGE_RATE_API_KEY ?? '').trim() ||
    (process.env.EXCHANGE_RATE_API_KEY ?? '').trim()
  return key || null
}

async function fetchExchangeRateApiLatestUsdKrw(
  fetchImpl: typeof fetch,
): Promise<number | null> {
  const key = readExchangeRateApiKey()
  if (!key) return null
  const url = `https://v6.exchangerate-api.com/v6/${encodeURIComponent(key)}/latest/USD`
  const res = await fetchImpl(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) return null
  const json = (await res.json()) as { result?: string; conversion_rates?: Record<string, number> }
  if (json.result !== 'success') return null
  const usdKrw = Number(json.conversion_rates?.KRW)
  if (!Number.isFinite(usdKrw) || !isSimplyurFxRateInBand('USD', usdKrw)) return null
  return usdKrw
}

/**
 * 입력일(rateDate) 기준 1 USD = N KRW.
 * Frankfurter(일자별) → 당일이면 ExchangeRate-API latest → env/default.
 */
export async function resolveUsdKrwRateForDate(
  rateDateInput: string | null | undefined,
  opts?: { now?: Date; fetchImpl?: typeof fetch },
): Promise<BongtourUsdKrwRateResult> {
  const now = opts?.now ?? new Date()
  const fetchImpl = opts?.fetchImpl ?? fetch
  const rateDate = assertYmd(rateDateInput?.trim() || seoulYmd(now))
  const today = seoulYmd(now)

  try {
    const fromFrank = await fetchFrankfurterUsdKrw(rateDate, fetchImpl)
    if (fromFrank) {
      return {
        rateDate,
        effectiveDate: fromFrank.effectiveDate,
        usdKrw: fromFrank.usdKrw,
        source: 'frankfurter',
      }
    }
  } catch {
    // fall through
  }

  if (rateDate === today) {
    try {
      const latest = await fetchExchangeRateApiLatestUsdKrw(fetchImpl)
      if (latest != null) {
        return {
          rateDate,
          effectiveDate: rateDate,
          usdKrw: latest,
          source: 'exchangerate_api_latest',
        }
      }
    } catch {
      // fall through
    }
  }

  const fallback = getSimplyurFxRates().USD
  return {
    rateDate,
    effectiveDate: rateDate,
    usdKrw: fallback,
    source: 'env_fallback',
  }
}
