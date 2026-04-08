import type { DepartureInput } from '@/lib/upsert-product-departures-verygoodtour'
import { buildCommonMatchingTrace, buildDepartureTitleLayers } from '@/lib/departure-option-verygoodtour'
import {
  maxYearMonth,
  scrapeCalendarTodayYmd,
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
    const menuCode = (u.searchParams.get('MenuCode') ?? 'leaveLayer').trim() || 'leaveLayer'
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
      return JSON.parse(match[1]) as Array<Record<string, unknown>>
    } catch {
      continue
    }
  }
  return []
}

function isoFromDateTime(date: string | null, hhmm: string | null): string | null {
  if (!date || !hhmm) return null
  const d = date.trim()
  const t = hhmm.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  if (!/^\d{1,2}:\d{2}$/.test(t)) return null
  const [hh, mm] = t.split(':')
  return `${d} ${hh.padStart(2, '0')}:${mm}`
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
    detailHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
    ''
  const titleLayers = buildDepartureTitleLayers(stripTags(rawTitle))
  const carrier = text.match(
    /(티웨이항공|대한항공|아시아나항공|제주항공|진에어|에어부산|에어서울|이스타항공)/
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
    carrierName: carrier ?? null,
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

export async function collectVerygoodDepartureInputs(
  detailUrl: string,
  options?: { monthCount?: number }
): Promise<VerygoodDepartureParsed[]> {
  const parsed = parseVerygoodParams(detailUrl)
  if (!parsed) return []
  const { proCode, menuCode, masterCode } = parsed
  const monthCount = Math.max(2, Math.min(12, options?.monthCount ?? SCRAPE_DEFAULT_MONTHS_FORWARD))

  const detailRes = await fetch(detailUrl, { method: 'GET' })
  if (!detailRes.ok) return []
  const detailHtml = await detailRes.text()
  const shared = extractSharedMeta(detailHtml)
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
  const todayYmd = scrapeCalendarTodayYmd()

  while (cursor && fetched < monthCount) {
    const { year, month } = cursor
    const monthKey = `${year}-${String(month).padStart(2, '0')}`
    if (visited.has(monthKey)) break
    visited.add(monthKey)

    const fragmentUrl = `${base}/Product/ProductCalendarSearch?MasterCode=${encodeURIComponent(
      masterCode
    )}&MenuCode=${encodeURIComponent(menuCode)}&Year=${year}&Month=${String(month).padStart(2, '0')}`
    const res = await fetch(fragmentUrl, { method: 'GET', headers: { Referer: detailUrl } })
    if (!res.ok) break
    const fragmentHtml = await res.text()
    const rows = parseCalendarJson(fragmentHtml)
    for (const v of rows) {
      const departureDate = String(v.DepartureDateToShortString ?? '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) continue
      if (departureDate < todayYmd) continue
      const adultPrice = Number(v.AdultPrice ?? 0)
      if (!Number.isFinite(adultPrice) || adultPrice <= 0) continue
      const statusRaw = String(v.BtnReserveAltTag ?? '').trim() || '예약가능'
      const minPax = Number(v.MinCount ?? shared.minPax ?? 0)
      const productCode = String(v.ProductCode ?? '').trim()
      const priceSeq = String(v.PriceSeq ?? '').trim()

      const carrierName = String(v.TrasnName ?? '').trim() || shared.carrierName
      const transCode = String(v.TransCode ?? '').trim()
      const transNo = String(v.TransNumber ?? '').replace(/\s+/g, '')
      const outboundFlightNo = transCode && transNo ? `${transCode}${transNo}` : null

      const arrivalDate = String(v.ArrivalDateToShortString ?? '').trim() || null
      const outTime = String(v.DepartureDepartureTime ?? '').trim() || null
      const inTime = String(v.ArrivalArrivalTime ?? '').trim() || null
      const supplierDepartureCodeCandidate = [productCode, priceSeq].filter(Boolean).join(':') || null
      const statusLabelsRaw = statusRaw ? JSON.stringify([statusRaw]) : null
      const candidateRawTitle = String(v.ProductName ?? v.ProductTitle ?? v.Title ?? shared.titleLayers.rawTitle ?? '').trim()
      const candidateLayers = buildDepartureTitleLayers(candidateRawTitle)
      const matchingTraceRaw = buildCommonMatchingTrace({
        source: 'verygood_calendar_json',
        supplier: 'verygood',
        baseline: shared.titleLayers,
        candidate: candidateLayers,
        notes: [
          '[SCRAPER_CANDIDATE] source=popup_right_row_json',
          '[SCRAPER_SELECTED] selected_reason=title+carrier+duration',
          '[SCRAPER_DATE_CLICK] refresh_detected=true',
          '[SCRAPER_DEDUPE] dedupe_key=departureDate+comparisonTitleNoSpace+carrierName+outboundDepartureAt',
          'price_ssot=popup_right_row',
        ],
        productCode: productCode || null,
        priceSeq: priceSeq || null,
      })

      const input: DepartureInput = {
        departureDate,
        adultPrice,
        statusRaw,
        statusLabelsRaw,
        minPax: Number.isFinite(minPax) && minPax > 0 ? minPax : shared.minPax,
        carrierName: carrierName ?? undefined,
        outboundFlightNo: outboundFlightNo ?? undefined,
        outboundDepartureAirport: shared.outboundDepartureAirport ?? undefined,
        outboundDepartureAt: isoFromDateTime(departureDate, outTime) ?? undefined,
        outboundArrivalAirport: shared.outboundArrivalAirport ?? undefined,
        inboundDepartureAirport: shared.inboundDepartureAirport ?? undefined,
        inboundArrivalAirport: shared.inboundArrivalAirport ?? undefined,
        inboundArrivalAt: isoFromDateTime(arrivalDate, inTime) ?? undefined,
        meetingInfoRaw: shared.meetingInfoRaw ?? undefined,
        meetingPointRaw: shared.meetingPointRaw ?? undefined,
        meetingTerminalRaw: shared.meetingTerminalRaw ?? undefined,
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
        candidateLayers.comparisonTitleNoSpace,
        String(carrierName ?? '').trim(),
        String(isoFromDateTime(departureDate, outTime) ?? '').trim(),
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
  const filtered = merged.filter((x) => x.raw.departureDate >= todayYmd)
  return filtered.map((x) => ({
    ...x,
    input: applyDepartureTerminalMeetingInfo([x.input])[0]!,
  }))
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
    `[SCRAPER_BASELINE] raw_title=${product.rawTitle} pre_hash_title=${product.preHashTitle} comparison_title=${product.comparisonTitle} comparison_title_no_space=${product.comparisonTitleNoSpace} carrier_name=${product.airline ?? ''} trip_nights=${product.tripNights ?? ''} trip_days=${product.tripDays ?? ''}`
  )
  return { product, notes }
}

export function getMasterCodeFromProCode(proCode: string): string {
  return (proCode ?? '').split('-')[0]?.trim() || proCode
}
