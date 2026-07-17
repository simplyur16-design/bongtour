/**
 * kyowontour — tourCode별 goodsEventDetail SSR HTML에서 예약인원·최소·잔여석·아동·유아 보강 (E2E·Selenium 없음).
 *
 * REGRESSION-FREEZE[kyowontour-tourcode-detail-meta]: tourCode detail SSR meta — manifest
 */
import type { KyowontourCalendarRow } from '@/lib/kyowontour-departures'
const KYOWONTOUR_BASE = process.env.KYOWONTOUR_BASE_URL ?? 'https://www.kyowontour.com'

export type KyowontourTourCodeDetailMeta = {
  tourCode: string
  reservationCount: number | null
  minPax: number | null
  maxPaxCount: number | null
  seatCount: number | null
  seatsStatusRaw: string | null
  statusId: number | null
  /** goodsEventDetail hidden `#childPrice` — 출발일 AJAX에는 없음 */
  childPrice: number | null
  /** goodsEventDetail hidden `#infantPrice` */
  infantPrice: number | null
}

function positiveInt(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null
}

function positivePrice(v: unknown): number | null {
  const n = Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

/** REGRESSION-FREEZE[kyowontour-tourcode-detail-meta]: hidden adult/child/infantPrice — manifest */
export function parseKyowontourThreeSlotPricesFromDetailHtml(html: string): {
  adultPrice: number | null
  childPrice: number | null
  infantPrice: number | null
} {
  const hidden = (id: string): number | null => {
    const re = new RegExp(
      `id=["']${id}["'][^>]*value=["']([\\d,]+)["']|value=["']([\\d,]+)["'][^>]*id=["']${id}["']`,
      'i',
    )
    const m = html.match(re)
    return positivePrice(m?.[1] ?? m?.[2])
  }
  return {
    adultPrice: hidden('adultPrice') ?? positivePrice(html.match(/goodsAdultPrice\s*=\s*["']([\d,]+)["']/i)?.[1]),
    childPrice: hidden('childPrice'),
    infantPrice: hidden('infantPrice'),
  }
}

/** goodsEventDetail SSR — `예약 0명 (최소 출발 인원 4명)` + fn_reservation count. */
export function parseKyowontourTourCodeDetailMetaFromHtml(
  tourCode: string,
  html: string,
): KyowontourTourCodeDetailMeta | null {
  const tc = tourCode.trim()
  if (!tc) return null

  const bookingCell = html.match(/예약\s*(\d+)\s*명\s*\(\s*최소\s*출발\s*인원\s*(\d+)\s*명\s*\)/)
  const reservationCount = bookingCell?.[1] != null ? positiveInt(bookingCell[1]) : null
  const minPax = bookingCell?.[2] != null ? positiveInt(bookingCell[2]) : null

  const maxM = html.match(/let\s+count\s*=\s*Number\("(\d+)"\)/)
  const maxPaxCount = maxM?.[1] != null ? positiveInt(maxM[1]) : null

  const statusM = html.match(/id="statusId"[^>]*value="(\d+)"/i)
  const statusId = statusM?.[1] != null ? positiveInt(statusM[1]) : null

  const remainDirect = html.match(/남은\s*좌석\s*(?:<em[^>]*>\s*)?(\d+)\s*(?:<\/em>\s*)?석/i)
  const remainDirectCount = remainDirect?.[1] != null ? positiveInt(remainDirect[1]) : null

  let seatCount: number | null = remainDirectCount
  if (seatCount == null && maxPaxCount != null && reservationCount != null && maxPaxCount >= reservationCount) {
    seatCount = maxPaxCount - reservationCount
  }
  const seatsStatusRaw = seatCount != null && seatCount >= 0 ? `잔여${seatCount}석` : null
  const slots = parseKyowontourThreeSlotPricesFromDetailHtml(html)

  if (
    reservationCount == null &&
    minPax == null &&
    maxPaxCount == null &&
    statusId == null &&
    slots.childPrice == null &&
    slots.infantPrice == null
  ) {
    return null
  }

  return {
    tourCode: tc,
    reservationCount,
    minPax: minPax != null && minPax > 0 ? minPax : null,
    maxPaxCount: maxPaxCount != null && maxPaxCount > 0 ? maxPaxCount : null,
    seatCount: seatCount != null && seatCount > 0 ? seatCount : null,
    seatsStatusRaw,
    statusId,
    childPrice: slots.childPrice,
    infantPrice: slots.infantPrice,
  }
}

export function buildKyowontourGoodsEventDetailUrl(tourCode: string, menuCode: string): string {
  const base = KYOWONTOUR_BASE.replace(/\/$/, '')
  const u = new URL(`${base}/goods/goodsEventDetail`)
  u.searchParams.set('tourCode', tourCode.trim())
  u.searchParams.set('menuCode', menuCode.trim())
  u.searchParams.set('brandId', '0')
  return u.toString()
}

function kyowontourTourCodeEnrichPauseMs(): number {
  const raw = Number(process.env.KYOWONTOUR_TOURCODE_ENRICH_PAUSE_MS ?? '180')
  return Number.isFinite(raw) && raw >= 0 ? raw : 180
}

function kyowontourTourCodeEnrichConcurrency(): number {
  const raw = Number(process.env.KYOWONTOUR_TOURCODE_ENRICH_CONCURRENCY ?? '3')
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 3
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchKyowontourTourCodeDetailMeta(
  tourCode: string,
  menuCode: string,
  refererUrl: string,
): Promise<KyowontourTourCodeDetailMeta | null> {
  const url = buildKyowontourGoodsEventDetailUrl(tourCode, menuCode)
  try {
    const res = await fetch(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'ko-KR',
        referer: refererUrl.trim() || `${KYOWONTOUR_BASE}/`,
        'user-agent': 'Mozilla/5.0 (compatible; BongTour/1.0)',
      },
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) return null
    const html = await res.text()
    return parseKyowontourTourCodeDetailMetaFromHtml(tourCode, html)
  } catch {
    return null
  }
}

function mergeMetaIntoCalendarRow(
  row: KyowontourCalendarRow,
  meta: KyowontourTourCodeDetailMeta,
): KyowontourCalendarRow {
  const raw = { ...(row.rawJson as Record<string, unknown>) }
  if (meta.reservationCount != null) raw.reservationCount = meta.reservationCount
  if (meta.minPax != null) raw.minDepartureCnt = meta.minPax
  if (meta.maxPaxCount != null) raw.maxPaxCount = meta.maxPaxCount
  if (meta.seatCount != null) raw.remaSeatCnt = meta.seatCount
  if (meta.seatsStatusRaw) raw.seatsStatusRaw = meta.seatsStatusRaw
  // REGRESSION-FREEZE[kyowontour-tourcode-detail-meta]: child/infant → rawJson for fact/map — manifest
  if (meta.childPrice != null) raw.childPrice = meta.childPrice
  if (meta.infantPrice != null) raw.infantPrice = meta.infantPrice
  return { ...row, rawJson: raw }
}

export type KyowontourTourCodeEnrichOptions = {
  menuCode: string
  refererUrl: string
  concurrency?: number
  pauseMs?: number
}

/** differentDepartDate dayAirList 후 — tourCode별 goodsEventDetail SSR로 seats·min 보강. */
export async function enrichKyowontourCalendarRowsWithTourCodeDetail(
  rows: KyowontourCalendarRow[],
  options: KyowontourTourCodeEnrichOptions,
): Promise<KyowontourCalendarRow[]> {
  if (rows.length === 0) return rows

  const concurrency = Math.max(1, options.concurrency ?? kyowontourTourCodeEnrichConcurrency())
  const pauseMs = Math.max(0, options.pauseMs ?? kyowontourTourCodeEnrichPauseMs())
  const cache = new Map<string, KyowontourTourCodeDetailMeta | null>()
  const uniqueCodes = [...new Set(rows.map((r) => r.tourCode.trim()).filter(Boolean))]

  for (let start = 0; start < uniqueCodes.length; start += concurrency) {
    const slice = uniqueCodes.slice(start, start + concurrency)
    await Promise.all(
      slice.map(async (tourCode) => {
        if (cache.has(tourCode)) return
        cache.set(
          tourCode,
          await fetchKyowontourTourCodeDetailMeta(tourCode, options.menuCode, options.refererUrl),
        )
      }),
    )
    if (start + concurrency < uniqueCodes.length && pauseMs > 0) {
      await sleepMs(pauseMs)
    }
  }

  return rows.map((row) => {
    const meta = cache.get(row.tourCode.trim())
    return meta ? mergeMetaIntoCalendarRow(row, meta) : row
  })
}

