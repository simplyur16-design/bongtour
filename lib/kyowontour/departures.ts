/**
 * 교원이지(kyowontour) — 출발일 캘린더 `/goods/differentDepartDate` HTTP 수집 (Phase 2-D).
 * 실패 시 명시적 에러 → Phase 2-E E2E(Selenium 등) fallback 연결 신호.
 */
import { normalizeCalendarDate } from '@/lib/date-normalize'
import type { ProductDepartureInput } from '@/lib/kyowontour/upsert-departures'

const DEFAULT_BASE = 'https://www.kyowontour.com'
const DEFAULT_MONTH_COUNT = Math.min(36, Math.max(1, Number(process.env.KYOWONTOUR_CALENDAR_MONTH_COUNT) || 12))
const DEFAULT_TIMEOUT_MS = Math.min(120_000, Math.max(5000, Number(process.env.KYOWONTOUR_CALENDAR_TIMEOUT_MS) || 30_000))
const DEFAULT_RETRY = Math.min(8, Math.max(0, Number(process.env.KYOWONTOUR_CALENDAR_RETRY) || 3))

function apiBaseUrl(): string {
  const u = (process.env.KYOWONTOUR_API_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '')
  return u || DEFAULT_BASE
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export type KyowontourCalendarRow = {
  departDate: string
  returnDate: string
  tourCode: string
  airline: string
  adultPriceFromCalendar: number
  status: 'available' | 'soldout' | 'closed' | 'unknown'
  rawJson: object
}

export type KyowontourCalendarFetchOptions = {
  timeoutMs?: number
  maxRetries?: number
  signal?: AbortSignal
  /** Phase 2-E: 세션·CSRF 쿠키 주입 */
  headers?: Record<string, string>
  /** 디버그 로그 (기본 true) */
  log?: boolean
  logLabel?: string
}

export type KyowontourCalendarRangeOptions = KyowontourCalendarFetchOptions & {
  /** 수집할 월 수 (기본 env 또는 12) */
  monthCount?: number
  /** 시작 월 (1일 기준, 기본: UTC 기준 이번 달) */
  startMonth?: Date
}

export class KyowontourCalendarHttpError extends Error {
  readonly code = 'KyowontourCalendarHttpError' as const
  constructor(
    message: string,
    readonly status?: number,
    readonly bodySnippet?: string,
    readonly hint?: 'E2E_FALLBACK_SUGGESTED'
  ) {
    super(message)
    this.name = 'KyowontourCalendarHttpError'
  }

  static is(e: unknown): e is KyowontourCalendarHttpError {
    return e instanceof KyowontourCalendarHttpError
  }
}

export class KyowontourCalendarParseError extends Error {
  readonly code = 'KyowontourCalendarParseError' as const
  constructor(message: string, readonly rawSnippet?: string) {
    super(message)
    this.name = 'KyowontourCalendarParseError'
  }

  static is(e: unknown): e is KyowontourCalendarParseError {
    return e instanceof KyowontourCalendarParseError
  }
}

function looksLikeHtml(text: string): boolean {
  const t = text.slice(0, 800).trimStart()
  return /^<!DOCTYPE/i.test(t) || /^<html/i.test(t) || (t.startsWith('<') && /<body[\s>]/i.test(t.slice(0, 2000)))
}

function snippet(text: string, max = 400): string {
  const s = text.replace(/\s+/g, ' ').trim()
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

function pickStr(o: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = o[k]
    if (v == null) continue
    const s = String(v).trim()
    if (s) return s
  }
  return ''
}

function pickNumber(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k]
    if (v == null) continue
    if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v)
    if (typeof v === 'string') {
      const n = Number(String(v).replace(/[,원\s]/g, ''))
      if (Number.isFinite(n)) return Math.round(n)
    }
  }
  return null
}

function normalizeDepartYmd(raw: string): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const cal = normalizeCalendarDate(s)
  if (cal) return cal
  const digits = s.replace(/\D/g, '')
  if (digits.length === 8) {
    const y = digits.slice(0, 4)
    const m = digits.slice(4, 6)
    const d = digits.slice(6, 8)
    return `${y}-${m}-${d}`
  }
  if (digits.length === 6) {
    return normalizeDepartYmd(`${digits.slice(0, 4)}-${digits.slice(4, 6)}-01`)
  }
  return null
}

function mapStatusToken(raw: string): KyowontourCalendarRow['status'] {
  const s = raw.trim()
  if (!s) return 'unknown'
  if (/마감|매진|sold\s*out|soldout|불가|취소|종료/i.test(s)) return 'soldout'
  if (/대기|접수|예약\s*가능|가능|진행|모집/i.test(s)) return 'available'
  if (/출발\s*확정|확정/i.test(s)) return 'available'
  if (/미운영|휴무|없음|준비중/i.test(s)) return 'closed'
  return 'unknown'
}

function extractResultData(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null
  const root = json as Record<string, unknown>
  /** 교원 실측: `{ statusCode, responseMsg, data: { dayAirList, monthEvtList } }` */
  const topData = root.data
  if (topData && typeof topData === 'object' && !Array.isArray(topData)) {
    return topData as Record<string, unknown>
  }
  const r1 = root.result
  if (r1 && typeof r1 === 'object' && !Array.isArray(r1)) {
    const r2 = (r1 as Record<string, unknown>).data
    if (r2 && typeof r2 === 'object' && !Array.isArray(r2)) return r2 as Record<string, unknown>
    return r1 as Record<string, unknown>
  }
  return root
}

function extractDayAirList(data: Record<string, unknown>): unknown[] {
  const v =
    data.dayAirList ??
    data.dayairList ??
    data.DayAirList ??
    data.day_air_list ??
    data.list ??
    data.rows
  if (Array.isArray(v)) return v
  return []
}

function normalizeCalendarRow(item: unknown, warnings: string[]): KyowontourCalendarRow | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null
  const o = item as Record<string, unknown>
  const departRaw = pickStr(o, [
    'departDate',
    'depDate',
    'startDate',
    'departureDate',
    'goDate',
    'START_DATE',
    'startYmd',
  ])
  const returnRaw = pickStr(o, [
    'returnDate',
    'arrDate',
    'endDate',
    'comeDate',
    'RETURN_DATE',
    'endYmd',
    'inDate',
  ])
  const departDate = normalizeDepartYmd(departRaw)
  const returnDate = normalizeDepartYmd(returnRaw) ?? ''
  if (!departDate) {
    warnings.push(`dayAirList 행 스킵: 출발일 파싱 실패 keys=${Object.keys(o).slice(0, 8).join(',')}`)
    return null
  }

  const tourCode = pickStr(o, ['tourCode', 'goodsCode', 'productCode', 'pkgCode', 'TOUR_CD', 'goodsNo'])
  if (!tourCode) {
    warnings.push(`dayAirList 행 경고: tourCode 없음 departDate=${departDate}`)
  }

  const airline = pickStr(o, ['airline', 'korAirline', 'airLineName', 'carrierName', 'AIRLINE', 'fltAirNm'])

  let adultPriceFromCalendar = pickNumber(o, ['adultPrice', 'price', 'salePrice', 'minPrice', 'ADULT_PRICE', 'adtAmt'])
  if (adultPriceFromCalendar == null || Number.isNaN(adultPriceFromCalendar)) {
    adultPriceFromCalendar = 0
    warnings.push(`adultPrice NaN/누락 → 0 처리: ${departDate} tourCode=${tourCode || '(none)'}`)
  }

  const statusRaw = pickStr(o, ['status', 'reserveStatus', 'statCd', 'STATUS', 'rsvStatNm', 'goodsStat'])
  const status = mapStatusToken(statusRaw)

  return {
    departDate,
    returnDate,
    tourCode,
    airline,
    adultPriceFromCalendar,
    status,
    rawJson: o as object,
  }
}

function addUtcMonths(d: Date, delta: number): Date {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + delta
  return new Date(Date.UTC(y, m, 1, 0, 0, 0, 0))
}

async function postDifferentDepartDate(
  masterCode: string,
  departMonth: string,
  departDateAnchor: string,
  options?: KyowontourCalendarFetchOptions
): Promise<{ text: string; contentType: string; status: number }> {
  const base = apiBaseUrl()
  const url = `${base}/goods/differentDepartDate`
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRetries = options?.maxRetries ?? DEFAULT_RETRY
  const log = options?.log !== false
  const label = options?.logLabel ?? 'kyowontour-calendar'

  const form = new URLSearchParams()
  form.set('masterCode', masterCode)
  form.set('departMonth', departMonth)
  form.set('departDate', departDateAnchor)

  const headers: Record<string, string> = {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'User-Agent':
      process.env.KYOWONTOUR_CALENDAR_USER_AGENT ??
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'X-Requested-With': 'XMLHttpRequest',
    ...(options?.headers ?? {}),
  }

  let lastErr: unknown
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: form.toString(),
        signal: options?.signal ?? ac.signal,
        cache: 'no-store',
      })
      clearTimeout(t)
      const contentType = res.headers.get('content-type') ?? ''
      const text = await res.text()

      if (log) {
        console.info(`[${label}] POST ${url}`, {
          attempt,
          status: res.status,
          departMonth,
          departDateAnchor,
          masterCode,
          contentType: snippet(contentType, 120),
          bodyLen: text.length,
        })
      }

      if (res.status >= 500) {
        lastErr = new KyowontourCalendarHttpError(`HTTP ${res.status} (서버)`, res.status, snippet(text), 'E2E_FALLBACK_SUGGESTED')
        if (attempt <= maxRetries) {
          await sleep(400 * attempt)
          continue
        }
        throw lastErr
      }

      if (res.status === 429) {
        lastErr = new KyowontourCalendarHttpError('HTTP 429 Too Many Requests', 429, snippet(text), 'E2E_FALLBACK_SUGGESTED')
        if (attempt <= maxRetries) {
          await sleep(1200 * attempt)
          continue
        }
        throw lastErr
      }

      if (res.status >= 400) {
        throw new KyowontourCalendarHttpError(
          `HTTP ${res.status} (클라이언트/인증·차단 가능)`,
          res.status,
          snippet(text),
          'E2E_FALLBACK_SUGGESTED'
        )
      }

      return { text, contentType, status: res.status }
    } catch (e) {
      clearTimeout(t)
      if (e instanceof KyowontourCalendarHttpError) throw e
      const aborted = e instanceof Error && e.name === 'AbortError'
      lastErr = aborted
        ? new KyowontourCalendarHttpError(`timeout ${timeoutMs}ms`, undefined, undefined, 'E2E_FALLBACK_SUGGESTED')
        : e
      if (attempt <= maxRetries) {
        await sleep(350 * attempt)
        continue
      }
      throw KyowontourCalendarHttpError.is(lastErr)
        ? lastErr
        : new KyowontourCalendarHttpError(
            lastErr instanceof Error ? lastErr.message : String(lastErr),
            undefined,
            undefined,
            'E2E_FALLBACK_SUGGESTED'
          )
    }
  }
  throw new KyowontourCalendarHttpError('retry exhausted', undefined, undefined, 'E2E_FALLBACK_SUGGESTED')
}

function parseCalendarResponseJson(
  text: string,
  logLabel: string
): { rows: KyowontourCalendarRow[]; monthEvtLen: number; warnings: string[] } {
  const warnings: string[] = []
  if (looksLikeHtml(text)) {
    throw new KyowontourCalendarHttpError(
      'HTML 응답(세션/차단/오류 페이지 가능)',
      undefined,
      snippet(text),
      'E2E_FALLBACK_SUGGESTED'
    )
  }
  let json: unknown
  try {
    json = JSON.parse(text) as unknown
  } catch {
    throw new KyowontourCalendarParseError('JSON 파싱 실패', snippet(text))
  }

  const data = extractResultData(json)
  if (!data) {
    warnings.push(`[${logLabel}] result.data 형식 아님 — 루트 키: ${json && typeof json === 'object' ? Object.keys(json as object).slice(0, 12).join(',') : '(n/a)'}`)
    return { rows: [], monthEvtLen: 0, warnings }
  }

  const dayList = extractDayAirList(data)
  const monthEvt =
    data.monthEvtList ?? (data as { month_evt_list?: unknown }).month_evt_list ?? data.MonthEvtList
  const monthEvtLen = Array.isArray(monthEvt) ? monthEvt.length : 0

  if (!Array.isArray(dayList)) {
    warnings.push(`[${logLabel}] dayAirList가 배열이 아님`)
    return { rows: [], monthEvtLen, warnings }
  }

  const rows: KyowontourCalendarRow[] = []
  const seen = new Map<string, KyowontourCalendarRow>()
  for (const raw of dayList) {
    const row = normalizeCalendarRow(raw, warnings)
    if (!row) continue
    const dedupeKey = `${row.departDate}|${row.tourCode || '_'}`
    if (seen.has(dedupeKey)) {
      warnings.push(`중복 출발일+tourCode: ${dedupeKey} — 후행 행 우선`)
    }
    seen.set(dedupeKey, row)
  }
  for (const r of seen.values()) rows.push(r)
  rows.sort((a, b) => a.departDate.localeCompare(b.departDate))
  return { rows, monthEvtLen, warnings }
}

/**
 * 한 달 분량 캘린더 AJAX 호출 후 정규화.
 */
export async function fetchKyowontourCalendarMonth(
  masterCode: string,
  monthYmd: string,
  options?: KyowontourCalendarFetchOptions
): Promise<KyowontourCalendarRow[]> {
  let yy: string
  let mm: string
  const digits = monthYmd.replace(/\D/g, '')
  if (digits.length >= 6) {
    yy = digits.slice(0, 4)
    mm = digits.slice(4, 6).padStart(2, '0')
  } else {
    const m = monthYmd.match(/^(\d{4})-(\d{1,2})/)
    if (!m) throw new KyowontourCalendarParseError(`invalid monthYmd: ${monthYmd}`)
    yy = m[1]
    mm = m[2].padStart(2, '0')
  }
  const departMonth = `${yy}${mm}`
  const departDateAnchor = `${departMonth}01`

  const { text, contentType } = await postDifferentDepartDate(masterCode, departMonth, departDateAnchor, options)
  const parseWarnings: string[] = []
  if (!contentType.toLowerCase().includes('json') && !text.trimStart().startsWith('{')) {
    parseWarnings.push(`비JSON Content-Type: ${snippet(contentType, 80)}`)
  }
  const logLabel = options?.logLabel ?? 'kyowontour-calendar-month'
  const parsed = parseCalendarResponseJson(text, logLabel)
  const allWarnings = [...parseWarnings, ...parsed.warnings]
  if (allWarnings.length && (options?.log !== false)) {
    console.warn(`[${logLabel}] warnings`, allWarnings)
  }
  if (parsed.monthEvtLen === 0 && parsed.rows.length === 0) {
    console.info(`[${logLabel}] empty month (no dayAirList rows) masterCode=${masterCode} month=${departMonth}`)
  }
  return parsed.rows
}

/**
 * N개월 범위 순회 수집 (월별 1회 POST).
 */
export async function collectKyowontourCalendarRange(
  masterCode: string,
  options?: KyowontourCalendarRangeOptions
): Promise<{ rows: KyowontourCalendarRow[]; warnings: string[] }> {
  const warnings: string[] = []
  const monthCount = options?.monthCount ?? DEFAULT_MONTH_COUNT
  const start = options?.startMonth ?? new Date()
  const byKey = new Map<string, KyowontourCalendarRow>()

  for (let i = 0; i < monthCount; i++) {
    const d = addUtcMonths(start, i)
    const { yy, mm } = (() => {
      const y = d.getUTCFullYear()
      const m = String(d.getUTCMonth() + 1).padStart(2, '0')
      return { yy: String(y), mm: m }
    })()
    const monthYmd = `${yy}-${mm}`
    try {
      const part = await fetchKyowontourCalendarMonth(masterCode, monthYmd, {
        ...options,
        logLabel: `${options?.logLabel ?? 'kyowontour-range'}:${monthYmd}`,
      })
      for (const r of part) {
        const k = `${r.departDate}|${r.tourCode || '_'}`
        if (byKey.has(k)) warnings.push(`월간 수집 중복 키 덮어씀: ${k}`)
        byKey.set(k, r)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      warnings.push(`월 ${monthYmd} 수집 실패: ${msg}`)
      if (KyowontourCalendarHttpError.is(e) && e.status && e.status < 500) {
        throw e
      }
      if (i === 0) throw e
    }
  }

  const rows = [...byKey.values()].sort((a, b) => a.departDate.localeCompare(b.departDate))
  return { rows, warnings }
}

/**
 * 캘린더 행 → `ProductDepartureInput[]` (DB upsert 입력).
 */
export function mapKyowontourCalendarToDepartureInputs(
  rows: KyowontourCalendarRow[],
  productId: string
): ProductDepartureInput[] {
  const out: ProductDepartureInput[] = []
  for (const r of rows) {
    const raw = r.rawJson as Record<string, unknown>
    const statusLabel = pickStr(raw, ['status', 'reserveStatus', 'statCd', 'STATUS', 'rsvStatNm', 'goodsStat'])
    out.push({
      departureDate: r.departDate,
      adultPrice: r.adultPriceFromCalendar > 0 ? r.adultPriceFromCalendar : null,
      carrierName: r.airline || null,
      supplierDepartureCodeCandidate: r.tourCode || null,
      statusRaw: statusLabel || (r.status === 'unknown' ? null : r.status),
      seatsStatusRaw: null,
      matchingTraceRaw: JSON.stringify({
        supplier: 'kyowontour',
        productId,
        returnDate: r.returnDate || null,
        source: 'differentDepartDate',
        normalizedStatus: r.status,
      }),
    })
  }
  return out
}
