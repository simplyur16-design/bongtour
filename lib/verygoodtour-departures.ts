import { repairUtf8MisreadAsLatin1 } from '@/lib/encoding-repair'
import { buildDepartureTitleLayers } from '@/lib/departure-option-verygoodtour'
import {
  buildDepartureTerminalInfo,
  normalizeDepartureAirportCode,
} from '@/lib/meeting-terminal-rules'

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

/** 상세 HTML만 fetch·파싱 (달력/모달 경로 없음). */
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
