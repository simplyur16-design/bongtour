import type { DepartureInput } from '@/lib/upsert-product-departures-ybtour'
import { normalizeDepartureDate } from '@/lib/upsert-product-departures-ybtour'
import { filterDepartureInputsOnOrAfterCalendarToday, scrapeCalendarTodayYmd } from '@/lib/scrape-date-bounds'
import {
  applyDepartureTerminalMeetingInfo,
  buildDepartureTerminalInfo,
  inferDepartureAirportCodeFromKoreanDetailText,
} from '@/lib/meeting-terminal-rules'
import { buildCommonMatchingTrace, buildDepartureTitleLayers, type DepartureTitleLayers } from '@/lib/departure-option-ybtour'

/** 노랑풍선 상품 `originSource` SSOT (영문 키: ybtour) */
export const YBTOUR_SOURCE = 'YBTOUR'
const MAX_TRACE_AUX_LEN = 1800
const TRACE_PREFIX = 'ybtour:trace:'

export type YellowBalloonMappingStatus = 'unconfirmed' | 'list-row-primary' | 'calendar-audit-only'

export type YellowBalloonCollectMeta = { filledFields: string[]; missingFields: string[]; mappingStatus: YellowBalloonMappingStatus; notes: string[] }
export type YellowBalloonIdentifiersSnapshot = { originCodeSsoCandidate: string | null; supplierGroupIdCandidate: string | null }
export type YellowBalloonListRowRaw = Record<string, unknown>

export type YellowBalloonProductCore = {
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
  primaryDestination: string | null
  destinationRaw: string | null
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
  meetingInfoRaw: string | null
  guideTypeRaw: string | null
  tourLeaderTypeRaw: string | null
  mandatoryLocalFee: number | null
  mandatoryCurrency: string | null
  includedText: string | null
  excludedText: string | null
  criticalExclusions: string | null
  optionalTourSummaryRaw: string | null
  hasOptionalTours: boolean | null
  cardBenefitSummaryShort: string | null
  registrationStatus: string | null
  themeLabelsRaw: string | null
  promotionLabelsRaw: string | null
  insuranceSummaryRaw: string | null
  hotelSummaryRaw: string | null
  foodSummaryRaw: string | null
  reservationNoticeRaw: string | null
  rawMeta: string | null
}

export type YellowBalloonRowParsed = {
  source: 'list-row' | 'calendar-audit-only'
  candidateRawTitle?: string | null
  candidatePreHashTitle?: string | null
  candidateComparisonTitle?: string | null
  candidateComparisonTitleNoSpace?: string | null
  departureDate?: string | null
  candidateDepartureDate?: string | null
  adultPrice?: number | null
  candidatePrice?: number | null
  statusRaw?: string | null
  candidateStatusRaw?: string | null
  seatsStatusRaw?: string | null
  candidateSeatStatusRaw?: string | null
  minPax?: number | null
  candidateTripNights?: number | null
  candidateTripDays?: number | null
  carrierName?: string | null
  candidateCarrierName?: string | null
  outboundDepartureAt?: string | null
  candidateOutboundDepartureAt?: string | null
  inboundArrivalAt?: string | null
  candidateInboundArrivalAt?: string | null
  supplierDepartureCodeCandidate?: string | null
  candidateSupplierDepartureCodeCandidate?: string | null
  rawRowText?: string | null
  rawPayload?: unknown
}

export type YellowBalloonCollectOptions = { signal?: AbortSignal; maxMonthsToScan?: number; duplicateDateStrategy?: 'first-wins' | 'richer-wins' }
export type YellowBalloonCollectResult = { inputs: DepartureInput[]; listRowRaws: YellowBalloonListRowRaw[]; meta: YellowBalloonCollectMeta; identifiers: YellowBalloonIdentifiersSnapshot }
export type YellowBalloonCollectorContext = { originUrl: string }
export type YellowBalloonProductInfoCollector = { collect: (ctx: YellowBalloonCollectorContext) => Promise<void> }
export type YellowBalloonTermsCollector = { collect: (ctx: YellowBalloonCollectorContext) => Promise<void> }
export type YellowBalloonItineraryCollector = { collect: (ctx: YellowBalloonCollectorContext) => Promise<void> }
export type YellowBalloonOptionsCollector = { collect: (ctx: YellowBalloonCollectorContext) => Promise<void> }

export function buildYellowBalloonTraceLocalPriceText(parts: { supplierDepartureCodeCandidate?: string | null; rawRowText?: string | null; rawPayload?: unknown }): string | null {
  const chunks: string[] = []
  if (parts.supplierDepartureCodeCandidate?.trim()) chunks.push(`depCode=${parts.supplierDepartureCodeCandidate.trim().slice(0, 200)}`)
  if (parts.rawRowText?.trim()) chunks.push(`raw=${parts.rawRowText.trim().slice(0, 600)}`)
  if (parts.rawPayload !== undefined) {
    try {
      chunks.push(`payload=${JSON.stringify(parts.rawPayload).slice(0, 400)}`)
    } catch {
      chunks.push('payload=<unserializable>')
    }
  }
  if (!chunks.length) return null
  const line = `${TRACE_PREFIX}${chunks.join('|')}`
  return line.length <= MAX_TRACE_AUX_LEN ? line : `${line.slice(0, MAX_TRACE_AUX_LEN - 3)}...`
}

export function departureDateSortKey(departureDate: string | Date): string | null {
  const d = normalizeDepartureDate(departureDate)
  return d ? d.toISOString().slice(0, 10) : null
}

function scoreDepartureRichness(input: DepartureInput): number {
  let s = 0
  if (input.adultPrice != null && input.adultPrice > 0) s += 3
  if (input.statusRaw?.trim()) s += 2
  if (input.seatsStatusRaw?.trim()) s += 2
  if (input.minPax != null && input.minPax > 0) s += 1
  return s
}

export function dedupeDepartureInputsByDate(inputs: DepartureInput[], strategy: 'first-wins' | 'richer-wins'): DepartureInput[] {
  const byKey = new Map<string, DepartureInput>()
  const order: string[] = []
  for (const input of inputs) {
    const key = departureDateSortKey(input.departureDate)
    if (!key) continue
    if (!byKey.has(key)) {
      byKey.set(key, input)
      order.push(key)
      continue
    }
    const prev = byKey.get(key)!
    if (strategy === 'richer-wins' && scoreDepartureRichness(input) > scoreDepartureRichness(prev)) byKey.set(key, input)
  }
  return order.map((k) => byKey.get(k)!)
}

export function yellowBalloonRowParsedToDepartureInput(row: YellowBalloonRowParsed): DepartureInput | null {
  if (row.source !== 'list-row' || !row.departureDate) return null
  const trace = buildYellowBalloonTraceLocalPriceText({
    supplierDepartureCodeCandidate: row.candidateSupplierDepartureCodeCandidate ?? row.supplierDepartureCodeCandidate,
    rawRowText: row.rawRowText,
    rawPayload: row.rawPayload,
  })
  const statusRaw = row.candidateStatusRaw ?? row.statusRaw ?? null
  return {
    departureDate: row.departureDate,
    adultPrice: row.candidatePrice ?? row.adultPrice ?? null,
    carrierName: row.candidateCarrierName ?? row.carrierName ?? null,
    outboundDepartureAt: row.candidateOutboundDepartureAt ?? row.outboundDepartureAt ?? null,
    inboundArrivalAt: row.candidateInboundArrivalAt ?? row.inboundArrivalAt ?? null,
    statusRaw,
    statusLabelsRaw: statusRaw ? JSON.stringify([statusRaw]) : null,
    seatsStatusRaw: row.candidateSeatStatusRaw ?? row.seatsStatusRaw ?? null,
    minPax: row.minPax ?? null,
    supplierDepartureCodeCandidate: row.candidateSupplierDepartureCodeCandidate ?? row.supplierDepartureCodeCandidate ?? null,
    matchingTraceRaw: buildCommonMatchingTrace({
      source: 'ybtour_popup_row',
      supplier: 'ybtour',
      candidate: {
        rawTitle: row.candidateRawTitle ?? '',
        preHashTitle: row.candidatePreHashTitle ?? '',
        comparisonTitle: row.candidateComparisonTitle ?? '',
        comparisonTitleNoSpace: row.candidateComparisonTitleNoSpace ?? '',
      },
      notes: ['price_ssot=popup_right_row'],
    }),
    localPriceText: trace,
  }
}

type YellowBalloonBaseline = {
  titleLayers: DepartureTitleLayers
  carrierName: string | null
  tripNights: number | null
  tripDays: number | null
  originCode: string | null
  supplierGroupId: string | null
}

function clean(s: string | null | undefined): string {
  return String(s ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
function parsePrice(raw: string): number | null {
  const m = raw.match(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/)
  if (!m?.[1]) return null
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}
function parseNightsDays(raw: string): { nights: number | null; days: number | null } {
  const m = raw.match(/(\d+)\s*박\s*(\d+)\s*일/)
  return m ? { nights: Number(m[1]), days: Number(m[2]) } : { nights: null, days: null }
}
function parseDateYmd(raw: string): string | null {
  const m = raw.match(/(20\d{2})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/)
  return m ? `${m[1]}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[3])).padStart(2, '0')}` : null
}

function extractBaselineFromDetail(detailHtml: string, originUrl: string): YellowBalloonBaseline {
  const titleHtml = detailHtml.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1] ?? detailHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''
  const titleLayers = buildDepartureTitleLayers(stripTags(titleHtml))
  const text = stripTags(detailHtml)
  const carrierName = clean(text.match(/(대한항공|아시아나항공|제주항공|진에어|티웨이항공|에어부산|에어서울|이스타항공)/)?.[1]) || null
  const nd = parseNightsDays(text)
  let originCode: string | null = null
  let supplierGroupId: string | null = null
  try {
    const u = new URL(originUrl)
    originCode = clean(u.searchParams.get('goodsCd') || u.searchParams.get('goodsCode') || u.searchParams.get('code') || '')
    supplierGroupId = clean(u.searchParams.get('groupCd') || u.searchParams.get('groupId') || '')
  } catch {}
  return { titleLayers, carrierName, tripNights: nd.nights, tripDays: nd.days, originCode: originCode || null, supplierGroupId: supplierGroupId || null }
}

function extractPopupRowsFromHtml(html: string, baseline: YellowBalloonBaseline): YellowBalloonRowParsed[] {
  const blocks = [
    ...(html.match(/<li[^>]*>[\s\S]*?\d{1,3}(?:,\d{3})+\s*원[\s\S]*?<\/li>/gi) ?? []),
    ...(html.match(/<div[^>]*class="[^"]*(?:row|item|option|departure)[^"]*"[^>]*>[\s\S]*?\d{1,3}(?:,\d{3})+\s*원[\s\S]*?<\/div>/gi) ?? []),
  ]
  const out: YellowBalloonRowParsed[] = []
  for (const block of blocks) {
    const rowTextRaw = clean(stripTags(block))
    const title = clean(block.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)?.[1] || baseline.titleLayers.rawTitle)
    const layers = buildDepartureTitleLayers(title)
    const depDate = parseDateYmd(rowTextRaw)
    const times = [...rowTextRaw.matchAll(/(\d{1,2}):(\d{2})/g)].map((m) => `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`)
    const nd = parseNightsDays(rowTextRaw)
    const carrier = clean(rowTextRaw.match(/(대한항공|아시아나항공|제주항공|진에어|티웨이항공|에어부산|에어서울|이스타항공)/)?.[1]) || baseline.carrierName
    const status = clean(rowTextRaw.match(/(출발확정|예약가능|예약\s*가능|대기예약|대기|마감)/)?.[1]) || null
    const seats = clean(rowTextRaw.match(/(잔여\s*\d+\s*석|좌석\s*\d+|대기예약|마감)/)?.[1]) || null
    const price = parsePrice(rowTextRaw)
    out.push({
      source: 'list-row',
      candidateRawTitle: layers.rawTitle,
      candidatePreHashTitle: layers.preHashTitle,
      candidateComparisonTitle: layers.comparisonTitle,
      candidateComparisonTitleNoSpace: layers.comparisonTitleNoSpace,
      departureDate: depDate,
      candidateDepartureDate: depDate,
      adultPrice: price,
      candidatePrice: price,
      statusRaw: status,
      candidateStatusRaw: status,
      seatsStatusRaw: seats,
      candidateSeatStatusRaw: seats,
      candidateTripNights: nd.nights ?? baseline.tripNights,
      candidateTripDays: nd.days ?? baseline.tripDays,
      carrierName: carrier,
      candidateCarrierName: carrier,
      outboundDepartureAt: depDate && times[0] ? `${depDate} ${times[0]}` : null,
      candidateOutboundDepartureAt: depDate && times[0] ? `${depDate} ${times[0]}` : null,
      inboundArrivalAt: depDate && times[1] ? `${depDate} ${times[1]}` : null,
      candidateInboundArrivalAt: depDate && times[1] ? `${depDate} ${times[1]}` : null,
      rawRowText: rowTextRaw,
      rawPayload: { html: block.slice(0, 800) },
    })
  }
  return out
}

function rowMatchesBaseline(row: YellowBalloonRowParsed, baseline: YellowBalloonBaseline): { pass: boolean; reason: string; failReason?: string } {
  // 노랑풍선 상품 동일성: 제목(comparisonTitleNoSpace)만 본다. 항공사·박/일은 출발 옵션별 변동값이므로 분리 기준에 넣지 않는다.
  if (!row.candidateComparisonTitleNoSpace || row.candidateComparisonTitleNoSpace !== baseline.titleLayers.comparisonTitleNoSpace) {
    return { pass: false, reason: 'none', failReason: 'comparison_title_no_space_mismatch' }
  }
  return { pass: true, reason: 'title_match' }
}

function dedupeRowsByComposite(rows: YellowBalloonRowParsed[]): YellowBalloonRowParsed[] {
  const byKey = new Map<string, YellowBalloonRowParsed>()
  for (const row of rows) {
    const rangeHead =
      (row.rawRowText ?? '').match(/20\d{2}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}\s*\([^)]+\)\s*\d{1,2}:\d{2}/)?.[0]?.slice(0, 80) ?? ''
    const key = [
      row.departureDate ?? '',
      row.candidateComparisonTitleNoSpace ?? '',
      rangeHead,
      clean(row.candidateCarrierName ?? row.carrierName ?? ''),
      String(row.candidatePrice ?? row.adultPrice ?? ''),
    ].join('|')
    if (!key.replace(/\|/g, '').trim()) continue
    const prev = byKey.get(key)
    if (!prev) byKey.set(key, row)
    else {
      const prevScore = scoreDepartureRichness(yellowBalloonRowParsedToDepartureInput(prev) ?? ({ departureDate: new Date() } as DepartureInput))
      const curScore = scoreDepartureRichness(yellowBalloonRowParsedToDepartureInput(row) ?? ({ departureDate: new Date() } as DepartureInput))
      if (curScore >= prevScore) byKey.set(key, row)
    }
  }
  return [...byKey.values()]
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) throw new Error(`ybtour fetch failed: ${res.status}`)
  return await res.text()
}

export async function collectYellowBalloonDepartureInputs(originUrl: string | null | undefined, options?: YellowBalloonCollectOptions): Promise<YellowBalloonCollectResult> {
  if (!originUrl?.trim()) {
    return {
      inputs: [],
      listRowRaws: [],
      identifiers: { originCodeSsoCandidate: null, supplierGroupIdCandidate: null },
      meta: { filledFields: [], missingFields: dedupeFieldStats([]).missing, mappingStatus: 'unconfirmed', notes: ['originUrl missing'] },
    }
  }
  const notes: string[] = []
  const html = await fetchText(originUrl)
  const baseline = extractBaselineFromDetail(html, originUrl)
  notes.push(`[SCRAPER_BASELINE] raw_title=${baseline.titleLayers.rawTitle} pre_hash_title=${baseline.titleLayers.preHashTitle} comparison_title=${baseline.titleLayers.comparisonTitle} comparison_title_no_space=${baseline.titleLayers.comparisonTitleNoSpace} carrier_name=${baseline.carrierName ?? ''} trip_nights=${baseline.tripNights ?? ''} trip_days=${baseline.tripDays ?? ''}`)
  const rows = extractPopupRowsFromHtml(html, baseline)
  const selected: YellowBalloonRowParsed[] = []
  for (const row of rows) {
    const m = rowMatchesBaseline(row, baseline)
    notes.push(`[SCRAPER_CANDIDATE] candidate_raw_title=${row.candidateRawTitle ?? ''} candidate_comparison_title=${row.candidateComparisonTitle ?? ''} candidate_comparison_title_no_space=${row.candidateComparisonTitleNoSpace ?? ''} candidate_carrier=${row.candidateCarrierName ?? ''} candidate_departure_date=${row.candidateDepartureDate ?? ''} candidate_outbound_departure_at=${row.candidateOutboundDepartureAt ?? ''} candidate_price=${row.candidatePrice ?? ''} match_result=${m.pass ? 'pass' : 'fail'} fail_reason=${m.failReason ?? ''}`)
    if (m.pass) {
      selected.push(row)
      notes.push(`[SCRAPER_SELECTED] clicked_date=${row.candidateDepartureDate ?? ''} selected_comparison_title=${row.candidateComparisonTitle ?? ''} selected_carrier=${row.candidateCarrierName ?? ''} selected_outbound_departure_at=${row.candidateOutboundDepartureAt ?? ''} selected_price=${row.candidatePrice ?? ''} selected_reason=${m.reason}`)
    }
  }
  const dedupedRows = dedupeRowsByComposite(selected)
  notes.push(
    `[SCRAPER_DEDUPE] before_count=${selected.length} after_count=${dedupedRows.length} dedupe_key=departureDate+title+departureRangeHead+carrier+price`
  )
  const inputs = dedupedRows.map(yellowBalloonRowParsedToDepartureInput).filter((x): x is DepartureInput => x != null)
  const deduped = dedupeDepartureInputsByDate(inputs, options?.duplicateDateStrategy ?? 'richer-wins')
  const todayYmd = scrapeCalendarTodayYmd()
  const dedupedAfterToday = filterDepartureInputsOnOrAfterCalendarToday(deduped)
  if (dedupedAfterToday.length !== deduped.length) {
    notes.push(
      `[SCRAPER_DATE_FLOOR] kst_today=${todayYmd} before=${deduped.length} after_today=${dedupedAfterToday.length}`
    )
  }
  const listRowRaws = rows.map((r, i) => ({ index: i, source: r.source, rawPayload: r.rawPayload ?? null, rawRowText: r.rawRowText ?? null }))
  return {
    inputs: applyDepartureTerminalMeetingInfo(dedupedAfterToday),
    listRowRaws,
    identifiers: { originCodeSsoCandidate: baseline.originCode, supplierGroupIdCandidate: baseline.supplierGroupId },
      meta: {
        filledFields: dedupeFieldStats(dedupedAfterToday).filled,
        missingFields: dedupeFieldStats(dedupedAfterToday).missing,
        mappingStatus: dedupedAfterToday.length ? 'list-row-primary' : 'unconfirmed',
        notes,
      },
  }
}

export async function collectYellowBalloonProductCore(originUrl: string): Promise<{ product: YellowBalloonProductCore; notes: string[] }> {
  const html = await fetchText(originUrl)
  const text = stripTags(html)
  const baseline = extractBaselineFromDetail(html, originUrl)
  const title = baseline.titleLayers.preHashTitle || baseline.titleLayers.rawTitle
  const mandatory = text.match(/(가이드|기사)\s*경비[^0-9A-Z]*([A-Z]{3})?\s*([0-9,]+)\s*([A-Z]{3}|원)?/i)
  const shoppingVisitCountTotal = Number(text.match(/쇼핑\s*(\d+)\s*회/)?.[1] ?? 0) || null
  const noShoppingFlag = /노쇼핑|NO\s*쇼핑/i.test(text) ? true : shoppingVisitCountTotal === 0 ? null : false
  const noOptionFlag = /노옵션|NO\s*옵션/i.test(text) ? true : null
  const optionalTourSummaryRaw = clean(text.match(/(선택관광[\s\S]{0,260})/i)?.[1]) || null
  const product: YellowBalloonProductCore = {
    originSource: YBTOUR_SOURCE,
    originCode: baseline.originCode,
    originUrl,
    supplierGroupId: baseline.supplierGroupId,
    supplierProductCode: baseline.originCode,
    rawTitle: baseline.titleLayers.rawTitle,
    preHashTitle: baseline.titleLayers.preHashTitle,
    comparisonTitle: baseline.titleLayers.comparisonTitle,
    comparisonTitleNoSpace: baseline.titleLayers.comparisonTitleNoSpace,
    title,
    primaryDestination: clean(text.match(/(여행지|방문도시)\s*[:：]\s*([^\n|]+)/)?.[2]) || null,
    destinationRaw: clean(text.match(/(여행지|방문도시)\s*[:：]\s*([^\n|]+)/)?.[2]) || null,
    imageUrl: clean(html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1]) || null,
    productType: clean(text.match(/(패키지|자유여행|에어텔|허니문)/)?.[1]) || null,
    summary: clean(text.match(/(상품\s*요약[\s\S]{0,240})/i)?.[1]) || null,
    benefitSummary: clean(text.match(/(혜택[\s\S]{0,180})/i)?.[1]) || null,
    airline: baseline.carrierName,
    duration: baseline.tripNights != null && baseline.tripDays != null ? `${baseline.tripNights}박 ${baseline.tripDays}일` : null,
    tripNights: baseline.tripNights,
    tripDays: baseline.tripDays,
    shoppingVisitCountTotal,
    noShoppingFlag,
    noOptionFlag,
    meetingInfoRaw:
      buildDepartureTerminalInfo(
        inferDepartureAirportCodeFromKoreanDetailText(text),
        baseline.carrierName
      ) ?? null,
    guideTypeRaw: clean(text.match(/(현지\s*가이드|인솔자)[^\n|]{0,120}/i)?.[0]) || null,
    tourLeaderTypeRaw: clean(text.match(/(인솔자\s*동행|노팁|팁포함)/i)?.[0]) || null,
    mandatoryLocalFee: mandatory?.[3] ? Number(mandatory[3].replace(/,/g, '')) : null,
    mandatoryCurrency: clean(mandatory?.[2] || mandatory?.[4]) || null,
    includedText: clean(text.match(/(?:포함사항|포함내역)\s*[:：]?\s*([\s\S]{0,420})(?:불포함|예약안내|유의사항)/i)?.[1]) || null,
    excludedText: clean(text.match(/(?:불포함사항|불포함내역)\s*[:：]?\s*([\s\S]{0,420})(?:예약안내|유의사항|선택관광)/i)?.[1]) || null,
    criticalExclusions: clean(text.match(/(가이드\/기사\s*경비|유류할증료\s*변동|선택관광\s*비용)/i)?.[1]) || null,
    optionalTourSummaryRaw,
    hasOptionalTours: optionalTourSummaryRaw ? !/없음|노옵션|미포함/.test(optionalTourSummaryRaw) : noOptionFlag === true ? false : null,
    cardBenefitSummaryShort: clean(text.match(/(카드\s*혜택[\s\S]{0,120})/i)?.[1]) || null,
    registrationStatus: 'pending',
    themeLabelsRaw: null,
    promotionLabelsRaw: null,
    insuranceSummaryRaw: clean(text.match(/(여행자\s*보험[\s\S]{0,180})/i)?.[1]) || null,
    hotelSummaryRaw: clean(text.match(/(숙소|호텔)[\s\S]{0,220}/i)?.[0]) || null,
    foodSummaryRaw: clean(text.match(/(식사[\s\S]{0,220})/i)?.[1]) || null,
    reservationNoticeRaw: clean(text.match(/(예약\s*시\s*유의|예약\s*안내)[\s\S]{0,220}/i)?.[0]) || null,
    rawMeta: JSON.stringify({ source: 'ybtour_detail_html', extractedAt: new Date().toISOString(), notes: ['departure price SSOT = popup right row'] }),
  }
  return { product, notes: ['ybtour product core extracted'] }
}

function dedupeFieldStats(inputs: DepartureInput[]): { filled: string[]; missing: string[] } {
  const keys = ['departureDate', 'adultPrice', 'carrierName', 'outboundDepartureAt', 'inboundArrivalAt', 'statusRaw', 'statusLabelsRaw', 'seatsStatusRaw', 'minPax', 'supplierDepartureCodeCandidate', 'matchingTraceRaw'] as const
  const filled: string[] = []
  const missing: string[] = []
  const any = inputs.length > 0
  for (const k of keys) {
    const ok = inputs.some((inp) => {
      if (k === 'departureDate') return departureDateSortKey(inp.departureDate) != null
      if (k === 'adultPrice') return inp.adultPrice != null && inp.adultPrice > 0
      if (k === 'statusRaw') return !!inp.statusRaw?.trim()
      if (k === 'carrierName') return !!inp.carrierName?.trim()
      if (k === 'outboundDepartureAt') return !!inp.outboundDepartureAt?.toString().trim()
      if (k === 'inboundArrivalAt') return !!inp.inboundArrivalAt?.toString().trim()
      if (k === 'statusLabelsRaw') return !!inp.statusLabelsRaw?.trim()
      if (k === 'seatsStatusRaw') return !!inp.seatsStatusRaw?.trim()
      if (k === 'minPax') return inp.minPax != null && inp.minPax > 0
      if (k === 'supplierDepartureCodeCandidate') return !!inp.supplierDepartureCodeCandidate?.trim()
      if (k === 'matchingTraceRaw') return !!inp.matchingTraceRaw?.trim()
      return false
    })
    if (any && ok) filled.push(k)
    else missing.push(k)
  }
  return { filled, missing }
}
