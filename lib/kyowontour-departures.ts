/**
 * 교보이지(kyowontour) 출발일 캘린더 — 사이트 내부 AJAX `POST /goods/differentDepartDate` (공개 HTTP, 인증 없음).
 * DOM 캘린더 클릭 대신 월별 JSON(`dayAirList`) 수집.
 */
import type { PrismaClient } from '@prisma/client'
import { buildCommonMatchingTrace, buildDepartureTitleLayers, type DepartureTitleLayers } from '@/lib/departure-option-kyowontour'
import type { DepartureInput } from '@/lib/upsert-product-departures-kyowontour'
import { upsertProductDepartures } from '@/lib/upsert-product-departures-kyowontour'

export type KyowontourCalendarRow = {
  departDate: string
  returnDate: string
  tourCode: string
  airline: string
  adultPriceFromCalendar: number
  status: 'available' | 'soldout' | 'closed' | 'unknown'
  rawJson: object
}

export type KyowontourCalendarRangeOptions = {
  timeoutMs?: number
  maxRetries?: number
  signal?: AbortSignal
  headers?: Record<string, string>
  log?: boolean
  logLabel?: string
  monthCount?: number
  startMonth?: Date
  tourCodeForE2EFallback?: string
  disableE2EFallback?: boolean
  e2eMasterCodeHint?: string | null
}

export type KyowontourDepartureUpsertResult = {
  created: number
  updated: number
  skipped: number
  errors: Array<{ departDate: string; error: string }>
  warnings: string[]
}

export type KyowontourUpsertOptions = {
  dryRun?: boolean
  abortOnFirstError?: boolean
  priceSpikeWarnRatio?: number
}

const DEFAULT_BASE = 'https://www.kyowontour.com'
const DEFAULT_MONTHS = 12
const DEFAULT_TIMEOUT_MS = 25_000

function apiBase(): string {
  return (process.env.KYOWONTOUR_API_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '')
}

function extractDataRoot(payload: Record<string, unknown>): Record<string, unknown> | null {
  const d = payload.data
  if (d && typeof d === 'object' && !Array.isArray(d)) return d as Record<string, unknown>
  const r = payload.result
  if (r && typeof r === 'object' && !Array.isArray(r)) {
    const rObj = r as Record<string, unknown>
    const d2 = rObj.data
    if (d2 && typeof d2 === 'object' && !Array.isArray(d2)) return d2 as Record<string, unknown>
    return rObj
  }
  return null
}

function parsePrice(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  const s = String(v).replace(/[^\d]/g, '')
  return s ? parseInt(s, 10) : 0
}

function mapStatus(raw: string): KyowontourCalendarRow['status'] {
  const s = raw.trim()
  if (!s) return 'unknown'
  if (/마감|매진|sold\s*out|불가|취소|종료/i.test(s)) return 'soldout'
  if (/대기|접수|예약\s*가능|가능|진행|모집|확정/i.test(s)) return 'available'
  if (/미운영|휴무|없음|준비중/i.test(s)) return 'closed'
  return 'unknown'
}

function normalizeYmd(raw: unknown): string {
  const s = String(raw ?? '')
    .trim()
    .replace(/\./g, '-')
    .replace(/\//g, '-')
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const digits = s.replace(/\D/g, '')
  if (digits.length >= 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  return ''
}

function dayAirToRow(
  item: Record<string, unknown>,
  tourCodeFallback: string,
  warnings: string[]
): KyowontourCalendarRow | null {
  const dep = normalizeYmd(
    item.departDate ?? item.depDate ?? item.startDate ?? item.goDate ?? item.START_DATE ?? ''
  )
  if (!dep) {
    warnings.push(`행 스킵: 출발일 없음 keys=${Object.keys(item).slice(0, 8).join(',')}`)
    return null
  }
  const ret =
    normalizeYmd(
      item.returnDate ?? item.arrDate ?? item.endDate ?? item.comeDate ?? item.RETURN_DATE ?? ''
    ) || ''
  const tc = String(
    item.tourCode ?? item.goodsCode ?? item.pkgCode ?? item.TOUR_CD ?? tourCodeFallback ?? ''
  ).trim()
  const airline = String(
    item.airline ??
      item.korAirline ??
      item.airLineName ??
      item.carrierName ??
      item.AIRLINE ??
      ''
  ).trim()
  const adultPriceFromCalendar = parsePrice(
    item.adultPrice ?? item.price ?? item.salePrice ?? item.ADULT_PRICE ?? item.adtAmt
  )
  if (adultPriceFromCalendar <= 0) {
    warnings.push(`adultPrice 0/누락: ${dep} tourCode=${tc}`)
  }
  const stRaw = String(
    item.status ?? item.reserveStatus ?? item.statCd ?? item.rsvStatNm ?? item.goodsStat ?? ''
  )
  return {
    departDate: dep,
    returnDate: ret,
    tourCode: tc || tourCodeFallback,
    airline,
    adultPriceFromCalendar,
    status: mapStatus(stRaw),
    rawJson: item,
  }
}

function ymList(start: Date, count: number): string[] {
  const y = start.getFullYear()
  const mo = start.getMonth() + 1
  const out: string[] = []
  let yy = y
  let mm = mo
  for (let i = 0; i < count; i++) {
    out.push(`${yy}${String(mm).padStart(2, '0')}`)
    mm++
    if (mm > 12) {
      mm = 1
      yy++
    }
  }
  return out
}

async function postDifferentDepartDateMonth(args: {
  masterCode: string
  departMonth: string
  timeoutMs: number
  signal?: AbortSignal
  extraHeaders?: Record<string, string>
  maxRetries: number
}): Promise<{ list: Record<string, unknown>[]; httpStatus: number }> {
  const url = `${apiBase()}/goods/differentDepartDate`
  const body = new URLSearchParams({
    masterCode: args.masterCode,
    departMonth: args.departMonth,
    departDate: `${args.departMonth}01`,
  })
  let lastStatus = 0
  for (let attempt = 1; attempt <= args.maxRetries; attempt++) {
    const signal = args.signal ?? AbortSignal.timeout(args.timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          ...(args.extraHeaders ?? {}),
        },
        body: body.toString(),
        signal,
      })
      lastStatus = res.status
      if (res.status >= 500 && attempt < args.maxRetries) {
        await new Promise((r) => setTimeout(r, 450 * attempt))
        continue
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status} ${txt.slice(0, 200)}`)
      }
      const payload = (await res.json()) as Record<string, unknown>
      const root = extractDataRoot(payload) ?? {}
      const lst = root.dayAirList ?? root.dayairList
      const list = Array.isArray(lst) ? (lst as Record<string, unknown>[]) : []
      return { list, httpStatus: res.status }
    } catch (e) {
      if (attempt >= args.maxRetries) throw e
      await new Promise((r) => setTimeout(r, 450 * attempt))
    }
  }
  return { list: [], httpStatus: lastStatus }
}

/**
 * `masterCode` 기준으로 월별 사이트 내부 AJAX를 호출해 출발 행을 모은다.
 * `dayAirList`가 비면 masterCode·네트워크·차단 여부를 확인한다(R-3-I E2E 보조 가능).
 */
export async function collectKyowontourCalendarRange(
  masterCode: string,
  options?: KyowontourCalendarRangeOptions
): Promise<{ rows: KyowontourCalendarRow[]; warnings: string[] }> {
  const code = (masterCode ?? '').trim()
  const warnings: string[] = []
  if (!code) return { rows: [], warnings: ['masterCode 비어 있음'] }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRetries = Math.max(1, Math.min(6, options?.maxRetries ?? 3))
  const monthCount = Math.max(1, Math.min(36, options?.monthCount ?? DEFAULT_MONTHS))
  const start = options?.startMonth ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const months = ymList(start, monthCount)
  const tourHint = (options?.tourCodeForE2EFallback ?? options?.e2eMasterCodeHint ?? code).trim()

  const byDate = new Map<string, KyowontourCalendarRow>()
  for (const ym of months) {
    try {
      const { list, httpStatus } = await postDifferentDepartDateMonth({
        masterCode: code,
        departMonth: ym,
        timeoutMs,
        signal: options?.signal,
        extraHeaders: options?.headers,
        maxRetries,
      })
      if (options?.log) {
        console.log(
          `[kyowontour-departures] ${options.logLabel ?? 'collect'} month=${ym} http=${httpStatus} rows=${list.length}`
        )
      }
      if (!list.length) {
        warnings.push(`${ym}: dayAirList 비어 있음(masterCode·응답 구조 확인)`)
      }
      for (const it of list) {
        const row = dayAirToRow(it, tourHint, warnings)
        if (row) byDate.set(row.departDate, row)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      warnings.push(`${ym}: ${msg.slice(0, 240)}`)
    }
  }

  const rows = [...byDate.values()].sort((a, b) => a.departDate.localeCompare(b.departDate))
  return { rows, warnings }
}

function titleLayersFromTourCode(tourCode: string): DepartureTitleLayers {
  return buildDepartureTitleLayers(tourCode || null)
}

/** 캘린더 행 → `upsert-product-departures-kyowontour` 입력 */
export function mapKyowontourCalendarToDepartureInputs(
  rows: KyowontourCalendarRow[],
  productId: string
): DepartureInput[] {
  const out: DepartureInput[] = []
  for (const r of rows) {
    const layers = titleLayersFromTourCode(r.tourCode)
    const trace = buildCommonMatchingTrace({
      source: 'kyowontour_differentDepartDate',
      supplier: 'kyowontour',
      baseline: layers,
      notes: [`productId=${productId}`, `tourCode=${r.tourCode}`, `status=${r.status}`],
    })
    out.push({
      departureDate: r.departDate,
      adultPrice: r.adultPriceFromCalendar > 0 ? r.adultPriceFromCalendar : null,
      carrierName: r.airline || null,
      statusRaw: r.status,
      supplierDepartureCodeCandidate: r.tourCode || null,
      matchingTraceRaw: trace,
    })
  }
  return out
}

/** `upsertProductDepartures` 래퍼 — 관리자 재수집·stub 호환 반환 형태 */
export async function upsertKyowontourDepartures(
  prisma: PrismaClient,
  productId: string,
  inputs: DepartureInput[],
  _options?: KyowontourUpsertOptions
): Promise<KyowontourDepartureUpsertResult> {
  const warnings: string[] = []
  const errors: Array<{ departDate: string; error: string }> = []
  if (_options?.dryRun) {
    return { created: 0, updated: 0, skipped: inputs.length, errors, warnings }
  }
  try {
    const n = await upsertProductDepartures(prisma, productId, inputs)
    return { created: n, updated: 0, skipped: 0, errors, warnings }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    errors.push({ departDate: '*', error: msg.slice(0, 500) })
    return { created: 0, updated: 0, skipped: inputs.length, errors, warnings }
  }
}
