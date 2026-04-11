import type { DepartureInput } from '@/lib/upsert-product-departures-verygoodtour'
import { repairUtf8MisreadAsLatin1 } from '@/lib/encoding-repair'
import { buildCommonMatchingTrace, buildDepartureTitleLayers } from '@/lib/departure-option-verygoodtour'
import {
  maxYearMonth,
  scrapeCalendarVerygoodDepartureFloorYmd,
  scrapeTodayYearMonth,
  SCRAPE_DEFAULT_MONTHS_FORWARD,
  yearMonthBefore,
} from '@/lib/scrape-date-bounds'
import {
  applyDepartureTerminalMeetingInfo,
  buildDepartureTerminalInfo,
  normalizeDepartureAirportCode,
} from '@/lib/meeting-terminal-rules'

export type VerygoodDepartureRaw = {
  productCode: string
  priceSeq: string
  departureDate: string
  adultPrice: number
  statusRaw: string
  minPax: number | null
}

export type VerygoodDepartureParsed = {
  input: DepartureInput
  raw: VerygoodDepartureRaw
}

export type VerygoodProductCore = {
  originSource: string
  originCode: string | null
  originUrl: string
  supplierGroupId: string | null
  supplierProductCode: string | null
  rawTitle: string
  preHashTitle: string
  comparisonTitle: string
  comparisonTitleNoSpace: string
  title: string
  destinationRaw: string | null
  primaryDestination: string | null
  imageUrl: string | null
  productType: string | null
  summary: string | null
  benefitSummary: string | null
  airline: string | null
  duration: string | null
  tripNights: number | null
  tripDays: number | null
  shoppingVisitCountTotal: number | null
  noShoppingFlag: boolean | null
  noOptionFlag: boolean | null
  noTipFlag: boolean | null
  optionalTourSummaryRaw: string | null
  hasOptionalTours: boolean | null
  includedText: string | null
  excludedText: string | null
  meetingInfoRaw: string | null
  meetingTerminalRaw: string | null
  mandatoryLocalFee: number | null
  mandatoryCurrency: string | null
  insuranceSummaryRaw: string | null
  hotelSummaryRaw: string | null
  foodSummaryRaw: string | null
  reservationNoticeRaw: string | null
  rawMeta: string | null
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseVerygoodParams(originUrl: string): { proCode: string; menuCode: string; masterCode: string } | null {
  try {
    const u = new URL(originUrl)
    const proCode = (u.searchParams.get('ProCode') ?? '').trim()
    if (!proCode) return null
    const menuCode =
      (u.searchParams.get('MenuCode') ?? u.searchParams.get('menuCode') ?? 'leaveLayer').trim() || 'leaveLayer'
    const masterCode = proCode.split('-')[0]?.trim() || proCode
    return { proCode, menuCode, masterCode }
  } catch {
    return null
  }
}

function parseCalendarJson(fragmentHtml: string): Array<Record<string, unknown>> {
  const patterns = [
    /var\s+\$calendarProductListJson\s*=\s*(\[[\s\S]*?\]);/,
    /\$calendarProductListJson\s*=\s*(\[[\s\S]*?\]);/,
    /calendarProductListJson\s*=\s*(\[[\s\S]*?\]);/i,
    /ProductCalendar\w*Json\s*=\s*(\[[\s\S]*?\]);/i,
  ]
  for (const re of patterns) {
    const match = fragmentHtml.match(re)
    if (!match?.[1]) continue
    try {
      const parsed = JSON.parse(match[1]) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as Array<Record<string, unknown>>
    } catch {
      continue
    }
  }
  return extractCalendarListJsonBracketBalanced(fragmentHtml)
}

/** non-greedy 정규식이 긴 배열을 잘못 자를 때 — Python `_extract_calendar_json_array_balanced` 와 동일 아이디어 */
function extractCalendarListJsonBracketBalanced(html: string): Array<Record<string, unknown>> {
  const markers = ['$calendarProductListJson', 'calendarProductListJson']
  for (const mk of markers) {
    const i = html.indexOf(mk)
    if (i < 0) continue
    const eq = html.indexOf('=', i)
    if (eq < 0) continue
    const j = html.indexOf('[', eq)
    if (j < 0) continue
    let depth = 0
    let inStr = false
    let esc = false
    for (let k = j; k < html.length; k++) {
      const ch = html[k]
      if (inStr) {
        if (esc) esc = false
        else if (ch === '\\') esc = true
        else if (ch === '"') inStr = false
        continue
      }
      if (ch === '"') {
        inStr = true
        continue
      }
      if (ch === '[') depth++
      else if (ch === ']') {
        depth--
        if (depth === 0) {
          const raw = html.slice(j, k + 1)
          try {
            const data = JSON.parse(raw) as unknown
            if (Array.isArray(data)) return data as Array<Record<string, unknown>>
          } catch {
            /* ignore */
          }
          break
        }
      }
    }
  }
  return []
}

function isoFromDateTime(date: string | null, hhmm: string | null): string | null {
  if (!date || !hhmm) return null
  const d = date.trim()
  const t = hhmm.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  const m = t.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  return `${d} ${m[1].padStart(2, '0')}:${m[2]}`
}

function verygoodNormalizeCalendarYmd(s: string | null | undefined): string | null {
  const t = String(s ?? '').trim()
  if (!t) return null
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dot = t.match(/^(\d{4})\.(\d{2})\.(\d{2})$/)
  if (dot) return `${dot[1]}-${dot[2]}-${dot[3]}`
  const slash = t.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (slash) {
    return `${slash[1]}-${String(Number(slash[2])).padStart(2, '0')}-${String(Number(slash[3])).padStart(2, '0')}`
  }
  return null
}

/** 출발일변경 모달 우측 리스트 JSON 행 — 문자열 값만 이어 붙여 일정 한 줄(`출발 ~ 귀국`) 탐색용 */
function verygoodCalendarRowStringHaystack(v: Record<string, unknown>): string {
  const parts: string[] = []
  for (const val of Object.values(v)) {
    if (typeof val === 'string') {
      const s = val.trim()
      if (s) parts.push(s)
    }
  }
  return parts.join('\n')
}

/**
 * 우측 리스트/JSON에 흔한 `2026.07.14(화) 23:40 ~ 2026.07.23(목) 17:00 | 7박10일` 형태.
 * `DepartureDateToShortString` 등 분리 필드가 비어 있을 때만 보조로 사용한다.
 */
function tryParseVerygoodCombinedScheduleRange(v: Record<string, unknown>): {
  departureDate: string
  outTime: string
  arrivalDate: string
  inTime: string
} | null {
  const hay = verygoodCalendarRowStringHaystack(v)
  if (!hay) return null
  const re =
    /(\d{4})[.\-/](\d{2})[.\-/](\d{2})(?:\s*\([^)]*\))?\s+(\d{1,2}):(\d{2})\s*~\s*(\d{4})[.\-/](\d{2})[.\-/](\d{2})(?:\s*\([^)]*\))?\s+(\d{1,2}):(\d{2})(?:\s*\|\s*\d+\s*박\s*\d+\s*일)?/u
  const m = hay.match(re)
  if (!m) return null
  const [, y1, mo1, d1, h1, mi1, y2, mo2, d2, h2, mi2] = m
  return {
    departureDate: `${y1}-${mo1}-${d1}`,
    outTime: `${h1}:${mi1}`,
    arrivalDate: `${y2}-${mo2}-${d2}`,
    inTime: `${h2}:${mi2}`,
  }
}

function extractSharedMeta(detailHtml: string): {
  titleLayers: ReturnType<typeof buildDepartureTitleLayers>
  carrierName: string | null
  outboundDepartureAirport: string | null
  outboundArrivalAirport: string | null
  inboundDepartureAirport: string | null
  inboundArrivalAirport: string | null
  meetingInfoRaw: string | null
  meetingPointRaw: string | null
  meetingTerminalRaw: string | null
  minPax: number | null
} {
  const text = stripTags(detailHtml)
  const rawTitle =
    detailHtml.match(/<h3[^>]*class="[^"]*package-title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ??
    detailHtml.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1] ??
    detailHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
    ''
  const titleLayers = buildDepartureTitleLayers(repairUtf8MisreadAsLatin1(stripTags(rawTitle)))
  const carrier = text.match(
    /(에미레이트항공|에미레이트|튀르키예항공|터키항공|카타르항공|카타르|에티하드항공|에티하드|영국항공|싱가포르항공|태국항공|베트남항공|티웨이항공|대한항공|아시아나항공|제주항공|진에어|에어부산|에어서울|이스타항공|에어프레미아|플라이강원|루프트한자|에어캐나다|델타항공|유나이티드항공|핀에어|ANA|전일본공수)/
  )?.[1]
  const minPaxMatch = text.match(/최소\s*출발\s*인원\s*[:：]?\s*(\d+)\s*명/)
  const minPax = minPaxMatch?.[1] ? Number(minPaxMatch[1]) : null

  const depBlock = detailHtml.match(/<div class="inout depature">([\s\S]*?)<\/div><\/div>/)
  const entBlock = detailHtml.match(/<div class="inout entry">([\s\S]*?)<\/div><\/div>/)
  const outDepAirport = depBlock?.[1]?.match(/<\/b>\s*([^<\s]+)\s*출발/)?.[1]?.trim() ?? null
  const outArrAirport = depBlock?.[1]?.match(/<\/b>\s*([^<\s]+)\s*도착/)?.[1]?.trim() ?? null
  const inDepAirport = entBlock?.[1]?.match(/<\/b>\s*([^<\s]+)\s*출발/)?.[1]?.trim() ?? null
  const inArrAirport = entBlock?.[1]?.match(/<\/b>\s*([^<\s]+)\s*도착/)?.[1]?.trim() ?? null

  const mt = detailHtml.match(/<h4 class="detail-h">미팅장소<\/h4>[\s\S]*?<p>\s*([\s\S]*?)\s*<\/p>/)
  const meetingPointRaw = mt?.[1] ? stripTags(mt[1]) : null
  const meetingTerminalRaw = meetingPointRaw?.match(/(제\d터미널|T\d)/)?.[1] ?? null

  return {
    titleLayers,
    carrierName: carrier ? repairUtf8MisreadAsLatin1(carrier) : null,
    outboundDepartureAirport: outDepAirport,
    outboundArrivalAirport: outArrAirport,
    inboundDepartureAirport: inDepAirport,
    inboundArrivalAirport: inArrAirport,
    meetingInfoRaw: meetingPointRaw,
    meetingPointRaw,
    meetingTerminalRaw,
    minPax: Number.isFinite(minPax as number) ? minPax : null,
  }
}

function monthRangeFromProCode(proCode: string, monthCount: number): Array<{ year: number; month: number }> {
  const m = proCode.match(/-(\d{2})(\d{2})\d{2}/)
  const start = m
    ? new Date(2000 + Number(m[1]), Number(m[2]) - 1, 1)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const out: Array<{ year: number; month: number }> = []
  for (let i = 0; i < monthCount; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  return out
}

function extractYearMonthFromHtml(
  html: string
): { current: { year: number; month: number } | null; next: { year: number; month: number } | null } {
  const currentMatch = html.match(/data-year="(\d{4})"\s+data-month="(\d{1,2})"/)
  const nextMatch = html.match(/btn_next_month[^>]*data-year="(\d{4})"[^>]*data-month="(\d{1,2})"/)
  const current = currentMatch
    ? { year: Number(currentMatch[1]), month: Number(currentMatch[2]) }
    : null
  const next = nextMatch ? { year: Number(nextMatch[1]), month: Number(nextMatch[2]) } : null
  return { current, next }
}

/** 상세 본문 텍스트에서 `N박M일` (시그니처용, 출발행 필드 보강에는 사용하지 않음) */
function extractTripLabelFromDetailHtml(detailHtml: string): string | null {
  const text = stripTags(detailHtml)
  const m = text.match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (!m) return null
  const nights = Number(m[1])
  const days = Number(m[2])
  if (!Number.isFinite(nights) || !Number.isFinite(days) || nights < 0 || days < 1) return null
  if (days < nights) return null
  return `${nights}박${days}일`
}

/** 상세 대표 제목 → 본문 순으로 박일(시그니처). 리스트 행 보강에는 쓰지 않음. */
function resolveDetailTripLabelForSignature(
  detailHtml: string,
  titleLayers: ReturnType<typeof buildDepartureTitleLayers>
): string | null {
  return (
    extractTripNightsDaysLabelFromText(titleLayers.comparisonTitle) ??
    extractTripNightsDaysLabelFromText(titleLayers.rawTitle) ??
    extractTripLabelFromDetailHtml(detailHtml)
  )
}

function parseVerygoodNightsDaysPair(label: string | null | undefined): { nights: number; days: number } | null {
  if (!label) return null
  const m = String(label).match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (!m) return null
  const nights = Number(m[1])
  const days = Number(m[2])
  if (!Number.isFinite(nights) || !Number.isFinite(days) || nights < 0 || days < 1 || days < nights) return null
  return { nights, days }
}

function extractTripNightsDaysLabelFromText(text: string): string | null {
  const t = stripTags(text).replace(/\s+/g, ' ')
  const m = t.match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (!m) return null
  const nights = Number(m[1])
  const days = Number(m[2])
  if (!Number.isFinite(nights) || !Number.isFinite(days) || nights < 0 || days < 1) return null
  if (days < nights) return null
  return `${nights}박${days}일`
}

function tripLabelFromCalendarRowJsonOnly(v: Record<string, unknown>): string | null {
  const pickPosInt = (x: unknown): number | null => {
    const n = Number(x)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
  }
  const nFromJson =
    pickPosInt((v as { TripNight?: unknown }).TripNight) ??
    pickPosInt((v as { TourNight?: unknown }).TourNight) ??
    pickPosInt((v as { NightCount?: unknown }).NightCount)
  const dFromJson =
    pickPosInt((v as { TripDay?: unknown }).TripDay) ??
    pickPosInt((v as { TourDay?: unknown }).TourDay) ??
    pickPosInt((v as { DayCount?: unknown }).DayCount)
  if (nFromJson != null && dFromJson != null && dFromJson >= nFromJson) return `${nFromJson}박${dFromJson}일`
  return null
}

/** 일정행 JSON·제목·행 문자열에서 N박M일 — 우선순위만(추측·다중 불일치 탈락 없음). */
function rowPrimaryNightsDays(
  v: Record<string, unknown>,
  rowTitle: string
): { nights: number; days: number } | null {
  const j = tripLabelFromCalendarRowJsonOnly(v)
  if (j) {
    const p = parseVerygoodNightsDaysPair(j)
    if (p) return p
  }
  const t = extractTripNightsDaysLabelFromText(rowTitle)
  if (t) {
    const p = parseVerygoodNightsDaysPair(t)
    if (p) return p
  }
  const h = extractTripNightsDaysLabelFromText(verygoodCalendarRowStringHaystack(v))
  if (h) {
    const p = parseVerygoodNightsDaysPair(h)
    if (p) return p
  }
  return null
}

type VerygoodModalListProductSignature = {
  proCode: string
  masterCode: string
  titleLayers: ReturnType<typeof buildDepartureTitleLayers>
  /** 표시·트레이스용 문자열 */
  tripLabel: string | null
  /** 달력·일정행 기준: 상세에서 본 N박M일 (없으면 제목만으로 필터) */
  tripNightsDays: { nights: number; days: number } | null
  /** 표시·로그용 — 일정행과 맞출 때는 `titleLayers.comparisonTitle` 전체 문자열 일치 사용 */
  detailTitleFront: string
}

function buildVerygoodModalListProductSignature(detailHtml: string, proCode: string): VerygoodModalListProductSignature {
  const shared = extractSharedMeta(detailHtml)
  const tripLabel = resolveDetailTripLabelForSignature(detailHtml, shared.titleLayers)
  const tripNightsDays = parseVerygoodNightsDaysPair(tripLabel)
  const detailTitleFront = (
    shared.titleLayers.preHashTitle ||
    shared.titleLayers.comparisonTitle ||
    ''
  ).trim()
  return {
    proCode,
    masterCode: proCode.split('-')[0]?.trim() || proCode,
    titleLayers: shared.titleLayers,
    tripLabel,
    tripNightsDays,
    detailTitleFront,
  }
}

/** 상세·일정행 **상품명** 동일(공백 정규화 + UTF-8 misread 복구). 유사도·접두 비교 없음. */
function verygoodModalListProductNameExactMatch(
  sig: VerygoodModalListProductSignature,
  rowLayers: ReturnType<typeof buildDepartureTitleLayers>
): boolean {
  const detailName = repairUtf8MisreadAsLatin1(
    (sig.titleLayers.comparisonTitle || sig.titleLayers.preHashTitle || '').replace(/\s+/g, ' ').trim()
  )
  const rowName = repairUtf8MisreadAsLatin1(
    (rowLayers.comparisonTitle || rowLayers.preHashTitle || '').replace(/\s+/g, ' ').trim()
  )
  return detailName.length > 0 && rowName.length > 0 && detailName === rowName
}

/**
 * 같은 상품: **같은 ProCode(마스터 접두)** + **N박M일** + **상품명 전체 일치**.
 */
function verygoodModalListRowMatchesDetailSignature(
  sig: VerygoodModalListProductSignature,
  v: Record<string, unknown>,
  rowTitle: string,
  rowLayers: ReturnType<typeof buildDepartureTitleLayers>
): boolean {
  const pc = String(v.ProductCode ?? '').trim()
  if (pc && sig.masterCode && !pc.toUpperCase().startsWith(sig.masterCode.toUpperCase())) return false

  const hasTrip = sig.tripNightsDays != null
  const hasTitle = Boolean((sig.titleLayers.comparisonTitle || sig.titleLayers.preHashTitle || '').trim())
  if (!hasTrip && !hasTitle) return true

  if (hasTrip) {
    const rowNd = rowPrimaryNightsDays(v, rowTitle)
    if (!rowNd) return false
    if (rowNd.nights !== sig.tripNightsDays!.nights || rowNd.days !== sig.tripNightsDays!.days) return false
  }

  if (hasTitle) {
    if (!verygoodModalListProductNameExactMatch(sig, rowLayers)) return false
  }

  return true
}

export type VerygoodDepartureAdapterProbe = {
  detailUrl: string
  proCode: string
  /** 일정 JSON에서 일정·가격·출발귀국 시각까지 갖춘 행(월 순회 합산, same-product 제외) */
  preSameProductScheduleRows: number
  /** same-product(마스터 접두+N박M일+상품명) 통과 후 dedupe 결과 */
  postSameProductRows: number
  detailProductNameNorm: string
  detailTripLabel: string | null
  rows: VerygoodDepartureParsed[]
}

async function collectVerygoodDepartureInputsWithStats(
  detailUrl: string,
  options?: { monthCount?: number }
): Promise<VerygoodDepartureAdapterProbe | null> {
  const parsed = parseVerygoodParams(detailUrl)
  if (!parsed) return null
  const { proCode, menuCode, masterCode } = parsed
  const monthCount = Math.max(2, Math.min(12, options?.monthCount ?? SCRAPE_DEFAULT_MONTHS_FORWARD))

  const fetchHtmlHeaders: HeadersInit = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  }

  const detailRes = await fetch(detailUrl, { method: 'GET', headers: fetchHtmlHeaders, cache: 'no-store' })
  if (!detailRes.ok) return null
  const detailHtml = await detailRes.text()
  const detailSig = buildVerygoodModalListProductSignature(detailHtml, proCode)

  const base = new URL(detailUrl).origin

  const byKey = new Map<string, VerygoodDepartureParsed>()
  const detailYearMonth = extractYearMonthFromHtml(detailHtml).current
  const fallbackMonths = monthRangeFromProCode(proCode, monthCount)
  const todayYm = scrapeTodayYearMonth()
  let cursor = detailYearMonth ?? fallbackMonths[0] ?? null
  if (cursor && yearMonthBefore(cursor, todayYm)) {
    cursor = maxYearMonth(cursor, todayYm)
  }
  const visited = new Set<string>()
  let fetched = 0
  /** KST 오늘+3일부터만 출발·금액 수집(당일·익일·모레 제외). */
  const departureFloorYmd = scrapeCalendarVerygoodDepartureFloorYmd()
  let preSameProductScheduleRows = 0

  while (cursor && fetched < monthCount) {
    const { year, month } = cursor
    const monthKey = `${year}-${String(month).padStart(2, '0')}`
    if (visited.has(monthKey)) break
    visited.add(monthKey)

    const fragmentUrl = `${base}/Product/ProductCalendarSearch?MasterCode=${encodeURIComponent(
      masterCode
    )}&MenuCode=${encodeURIComponent(menuCode)}&Year=${year}&Month=${String(month).padStart(2, '0')}`
    const res = await fetch(fragmentUrl, {
      method: 'GET',
      headers: { ...fetchHtmlHeaders, Referer: detailUrl },
      cache: 'no-store',
    })
    if (!res.ok) break
    const fragmentHtml = await res.text()
    const rows = parseCalendarJson(fragmentHtml)
    for (const v of rows) {
      const departureDate = String(v.DepartureDateToShortString ?? '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) continue
      if (departureDate < departureFloorYmd) continue
      const adultPrice = Number(v.AdultPrice ?? 0)
      if (!Number.isFinite(adultPrice) || adultPrice <= 0) continue
      const statusRaw =
        repairUtf8MisreadAsLatin1(String(v.BtnReserveAltTag ?? '').trim()) || '예약가능'
      const minPax = Number(v.MinCount ?? 0)
      const productCode = String(v.ProductCode ?? '').trim()
      const priceSeq = String(v.PriceSeq ?? '').trim()

      const carrierName =
        repairUtf8MisreadAsLatin1(
          String(
            v.TrasnName ??
              (v as { TransName?: unknown }).TransName ??
              (v as { CarrierName?: unknown }).CarrierName ??
              (v as { AirLineName?: unknown }).AirLineName ??
              ''
          ).trim()
        ) || '미표기'
      const transCode = String(v.TransCode ?? '').trim()
      const transNo = String(v.TransNumber ?? '').replace(/\s+/g, '')
      const outboundFlightNo = transCode && transNo ? `${transCode}${transNo}` : null

      let arrivalDate =
        String(
          v.ArrivalDateToShortString ??
            (v as { ReturnDateToShortString?: unknown }).ReturnDateToShortString ??
            ''
        ).trim() || null
      let outTime =
        String(
          v.DepartureDepartureTime ?? (v as { DepartureTime?: unknown }).DepartureTime ?? ''
        ).trim() || null
      let inTime =
        String(v.ArrivalArrivalTime ?? (v as { ArrivalTime?: unknown }).ArrivalTime ?? '').trim() || null

      const hadSplitSchedule = Boolean(arrivalDate && outTime && inTime)
      const comb = tryParseVerygoodCombinedScheduleRange(v)
      const depNorm = verygoodNormalizeCalendarYmd(departureDate)
      let filledScheduleFromCombinedLine = false
      if (comb && depNorm) {
        const combStart = verygoodNormalizeCalendarYmd(comb.departureDate)
        if (combStart === depNorm) {
          if (!outTime) {
            outTime = comb.outTime
            filledScheduleFromCombinedLine = true
          }
          if (!arrivalDate) {
            arrivalDate = comb.arrivalDate
            filledScheduleFromCombinedLine = true
          }
          if (!inTime) {
            inTime = comb.inTime
            filledScheduleFromCombinedLine = true
          }
        }
      }

      if (!arrivalDate || !outTime || !inTime) continue
      const outIso = isoFromDateTime(departureDate, outTime)
      const inIso = isoFromDateTime(arrivalDate, inTime)
      if (!outIso || !inIso) continue
      preSameProductScheduleRows += 1

      const listRowTitle = repairUtf8MisreadAsLatin1(
        String(v.ProductName ?? v.ProductTitle ?? v.Title ?? '').trim()
      )
      const listRowTitleLayers = buildDepartureTitleLayers(listRowTitle || ' ')
      if (!verygoodModalListRowMatchesDetailSignature(detailSig, v, listRowTitle, listRowTitleLayers)) continue

      const supplierDepartureCodeCandidate = [productCode, priceSeq].filter(Boolean).join(':') || null
      const statusLabelsRaw = JSON.stringify([statusRaw].filter((x) => String(x).trim()))
      const restRaw =
        (v as { restSeatCount?: unknown; RestSeatCount?: unknown }).restSeatCount ??
        (v as { RestSeatCount?: unknown }).RestSeatCount ??
        (v as { RemainSeatCount?: unknown }).RemainSeatCount ??
        (v as { SeatCount?: unknown }).SeatCount
      let seatCount: number | undefined
      let seatsStatusRaw: string
      if (typeof restRaw === 'number' && Number.isFinite(restRaw) && restRaw >= 0) {
        seatCount = Math.floor(restRaw)
        seatsStatusRaw = `잔여${seatCount}`
      } else if (typeof restRaw === 'string' && /^\d+$/.test(restRaw.trim())) {
        seatCount = Math.floor(Number(restRaw.trim()))
        seatsStatusRaw = `잔여${seatCount}`
      } else if (/마감|예약\s*마감|예약마감|불가|취소/.test(statusRaw)) {
        seatCount = 0
        seatsStatusRaw = '잔여0'
      } else if (/예약\s*가능|예약가능|가능|대기\s*예약|대기|신청/i.test(statusRaw)) {
        /** API에 좌석 수가 없어도 행은 유지 — 저장 후 UI는 행 SSOT */
        seatCount = undefined
        seatsStatusRaw = '좌석수미표기'
      } else {
        seatCount = undefined
        seatsStatusRaw = '좌석수미표기'
      }

      const airlineName = String(carrierName ?? '').trim() || '미표기'
      const bookingStatus = String(statusRaw ?? '').trim()
      if (!bookingStatus || !outIso || !inIso) continue

      const traceNotes = [
        '[VG_LIST_CANDIDATE] source=modal_right_list_json',
        '[VG_LIST_SELECTED] reason=master_prefix+trip_nd+product_name_exact',
        `[VG_LIST_DEDUPE] key=departureDate+productCode+priceSeq+carrier+outAt+inAt+adultPrice`,
        'price_ssot=modal_list_row',
        'row_fields=departure+return+price+bookingStatus+carrier',
        `departure_date_floor=kst_today_plus3_gte_${departureFloorYmd}`,
      ]
      if (filledScheduleFromCombinedLine && !hadSplitSchedule) {
        traceNotes.push('[VG_LIST_SCHEDULE] source=combined_text_range_fallback')
      }
      const matchingTraceRaw = buildCommonMatchingTrace({
        source: 'verygood_modal_list_json',
        supplier: 'verygood',
        baseline: detailSig.titleLayers,
        candidate: listRowTitleLayers,
        notes: traceNotes,
        productCode: productCode || null,
        priceSeq: priceSeq || null,
      })

      const input: DepartureInput = {
        departureDate,
        adultPrice,
        statusRaw,
        statusLabelsRaw,
        seatsStatusRaw,
        ...(seatCount !== undefined ? { seatCount } : {}),
        minPax: Number.isFinite(minPax) && minPax > 0 ? minPax : undefined,
        carrierName: airlineName,
        outboundFlightNo: outboundFlightNo ?? undefined,
        outboundDepartureAt: outIso ?? undefined,
        inboundArrivalAt: inIso ?? undefined,
        supplierDepartureCodeCandidate,
        matchingTraceRaw,
      }
      const raw: VerygoodDepartureRaw = {
        productCode,
        priceSeq,
        departureDate,
        adultPrice,
        statusRaw,
        minPax: Number.isFinite(minPax) && minPax > 0 ? minPax : null,
      }
      const dedupeKey = [
        departureDate,
        productCode || '_',
        priceSeq || '_',
        airlineName,
        outIso,
        inIso,
        String(adultPrice),
      ].join('|')
      const prev = byKey.get(dedupeKey)
      if (!prev) {
        byKey.set(dedupeKey, { input, raw })
      } else {
        const prevScore =
          (prev.input.adultPrice != null ? 2 : 0) +
          (prev.input.outboundDepartureAt ? 1 : 0) +
          (prev.input.statusRaw ? 1 : 0) +
          (prev.input.seatsStatusRaw ? 1 : 0)
        const curScore =
          (input.adultPrice != null ? 2 : 0) +
          (input.outboundDepartureAt ? 1 : 0) +
          (input.statusRaw ? 1 : 0) +
          (input.seatsStatusRaw ? 1 : 0)
        if (curScore >= prevScore) byKey.set(dedupeKey, { input, raw })
      }
    }
    fetched += 1
    const nav = extractYearMonthFromHtml(fragmentHtml).next
    if (nav) {
      cursor = nav
      continue
    }
    const nextDate = new Date(year, month, 1)
    cursor = { year: nextDate.getFullYear(), month: nextDate.getMonth() + 1 }
  }
  const merged = [...byKey.values()].sort((a, b) => a.raw.departureDate.localeCompare(b.raw.departureDate))
  const filtered = merged.filter((x) => x.raw.departureDate >= departureFloorYmd)
  const rows = filtered.map((x) => ({
    ...x,
    input: applyDepartureTerminalMeetingInfo([x.input])[0]!,
  }))
  const detailProductNameNorm = repairUtf8MisreadAsLatin1(
    (detailSig.titleLayers.comparisonTitle || detailSig.titleLayers.preHashTitle || '').replace(/\s+/g, ' ').trim()
  )
  return {
    detailUrl,
    proCode,
    preSameProductScheduleRows,
    postSameProductRows: rows.length,
    detailProductNameNorm,
    detailTripLabel: detailSig.tripLabel,
    rows,
  }
}

/** live 어댑터 동일 로직 + pre/post 행 수(검증·스크립트용). */
export async function runVerygoodDepartureAdapterLiveProbe(
  detailUrl: string,
  options?: { monthCount?: number }
): Promise<VerygoodDepartureAdapterProbe | null> {
  return collectVerygoodDepartureInputsWithStats(detailUrl, options)
}

export async function collectVerygoodDepartureInputs(
  detailUrl: string,
  options?: { monthCount?: number }
): Promise<VerygoodDepartureParsed[]> {
  const probe = await collectVerygoodDepartureInputsWithStats(detailUrl, options)
  return probe?.rows ?? []
}

export async function collectVerygoodProductCore(detailUrl: string): Promise<{ product: VerygoodProductCore | null; notes: string[] }> {
  const notes: string[] = []
  const parsed = parseVerygoodParams(detailUrl)
  if (!parsed) return { product: null, notes: ['invalid verygood url'] }
  const detailRes = await fetch(detailUrl, { method: 'GET' })
  if (!detailRes.ok) return { product: null, notes: [`detail fetch failed: ${detailRes.status}`] }
  const detailHtml = await detailRes.text()
  const text = stripTags(detailHtml)
  const shared = extractSharedMeta(detailHtml)
  const nightsDays = text.match(/(\d+)\s*박\s*(\d+)\s*일/)
  const tripNights = nightsDays?.[1] ? Number(nightsDays[1]) : null
  const tripDays = nightsDays?.[2] ? Number(nightsDays[2]) : null
  const mandatory = text.match(/(가이드|기사)\s*경비[^0-9A-Z]*([A-Z]{3})?\s*([0-9,]+)\s*([A-Z]{3}|원)?/i)
  const shoppingVisitCountTotal = Number(text.match(/쇼핑\s*(\d+)\s*회/)?.[1] ?? 0) || null
  const noShoppingFlag = /노쇼핑|NO\s*쇼핑/i.test(text) ? true : shoppingVisitCountTotal === 0 ? null : false
  const noOptionFlag = /노옵션|NO\s*옵션/i.test(text) ? true : null
  const noTipFlag = /노팁|NO\s*팁/i.test(text) ? true : null
  const optionalTourSummaryRaw = text.match(/(선택관광[\s\S]{0,240})/i)?.[1]?.trim() ?? null
  const product: VerygoodProductCore = {
    originSource: 'VERYGOODTOUR',
    originCode: parsed.proCode,
    originUrl: detailUrl,
    supplierGroupId: parsed.masterCode,
    supplierProductCode: parsed.proCode,
    rawTitle: shared.titleLayers.rawTitle,
    preHashTitle: shared.titleLayers.preHashTitle,
    comparisonTitle: shared.titleLayers.comparisonTitle,
    comparisonTitleNoSpace: shared.titleLayers.comparisonTitleNoSpace,
    title: shared.titleLayers.preHashTitle || shared.titleLayers.rawTitle,
    destinationRaw: text.match(/(여행지|방문도시)\s*[:：]?\s*([^\n|]+)/)?.[2]?.trim() ?? null,
    primaryDestination: text.match(/(여행지|방문도시)\s*[:：]?\s*([^\n|]+)/)?.[2]?.trim() ?? null,
    imageUrl: detailHtml.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1]?.trim() ?? null,
    productType: text.match(/(패키지|자유여행|허니문|골프)/)?.[1]?.trim() ?? null,
    summary: text.match(/(상품\s*요약[\s\S]{0,220})/i)?.[1]?.trim() ?? null,
    benefitSummary: text.match(/(혜택[\s\S]{0,180})/i)?.[1]?.trim() ?? null,
    airline: shared.carrierName,
    duration: tripNights != null && tripDays != null ? `${tripNights}박 ${tripDays}일` : null,
    tripNights,
    tripDays,
    shoppingVisitCountTotal,
    noShoppingFlag,
    noOptionFlag,
    noTipFlag,
    optionalTourSummaryRaw,
    hasOptionalTours: optionalTourSummaryRaw ? !/없음|노옵션|미포함/.test(optionalTourSummaryRaw) : null,
    includedText: text.match(/(?:포함사항|포함내역)\s*[:：]?\s*([\s\S]{0,420})(?:불포함|예약안내|유의사항)/i)?.[1]?.trim() ?? null,
    excludedText: text.match(/(?:불포함사항|불포함내역)\s*[:：]?\s*([\s\S]{0,420})(?:예약안내|유의사항|선택관광)/i)?.[1]?.trim() ?? null,
    meetingInfoRaw:
      buildDepartureTerminalInfo(normalizeDepartureAirportCode(shared.outboundDepartureAirport), shared.carrierName) ??
      null,
    meetingTerminalRaw: null,
    mandatoryLocalFee: mandatory?.[3] ? Number(mandatory[3].replace(/,/g, '')) : null,
    mandatoryCurrency: (mandatory?.[2] || mandatory?.[4] || '').trim() || null,
    insuranceSummaryRaw: text.match(/(여행자\s*보험[\s\S]{0,180})/i)?.[1]?.trim() ?? null,
    hotelSummaryRaw: text.match(/(숙소|호텔)[\s\S]{0,220}/i)?.[0]?.trim() ?? null,
    foodSummaryRaw: text.match(/(식사[\s\S]{0,220})/i)?.[1]?.trim() ?? null,
    reservationNoticeRaw: text.match(/(예약\s*안내|예약\s*시\s*유의)[\s\S]{0,220}/i)?.[0]?.trim() ?? null,
    rawMeta: JSON.stringify({
      source: 'verygood_detail_html',
      extractedAt: new Date().toISOString(),
      notes: ['departure_price_ssot=popup_right_row', 'calendar_price_not_used_for_adultPrice'],
    }),
  }
  notes.push(
    `[VG_DETAIL_HTML_BASELINE] raw_title=${product.rawTitle} pre_hash_title=${product.preHashTitle} comparison_title=${product.comparisonTitle} comparison_title_no_space=${product.comparisonTitleNoSpace} carrier_name=${product.airline ?? ''} trip_nights=${product.tripNights ?? ''} trip_days=${product.tripDays ?? ''}`
  )
  return { product, notes }
}

export function getMasterCodeFromProCode(proCode: string): string {
  return (proCode ?? '').split('-')[0]?.trim() || proCode
}
