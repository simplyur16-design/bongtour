/**
 * 롯데관광(lottetour) 관리자 등록 — **본문 축** 스냅샷만 조립한다.
 *
 * 담당: 본문 정규화, 섹션 앵커·분리·슬라이스, 호텔 본문 구조화, 포함/불포함, `raw.flightRaw` 등 슬라이스 원료,
 * 약관/예약금 경계(클립). 일정 원료는 섹션 텍스트로만 남기고 일차 배열화는 하지 않는다.
 *
 * **비담당(SSOT = 입력 파서):** 항공·선택관광/옵션·쇼핑 구조화 — `register-input-parse-lottetour` 및
 * `register-parse-lottetour`의 정형 입력란만이 구조화한다. 본문에 동일 문구가 있어도 여기서는 채우지 않는다.
 *
 * @see docs/body-parser-lottetour-ssot.md
 *
 * 상위 규약: `docs/admin-register-supplier-precise-spec.md` §4. 일정 표현: `docs/register_schedule_expression_ssot.md`.
 */
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser-types'
import {
  emptyFlightStructured,
  emptyOptionalToursStructured,
  emptyShoppingStructured,
} from '@/lib/detail-body-parser-input-axis-stubs'
import { normalizeDetailRawText, splitDetailSections, sliceDetailBodySections } from '@/lib/detail-body-parser-utils-lottetour'
import { parseHotelSectionLottetour } from '@/lib/hotel-parser-lottetour'
import { parseLottetourIncludedExcludedSection } from '@/lib/register-lottetour-basic'
import { buildDetailReviewPolicyLottetour } from '@/lib/review-policy-lottetour'

/** 포함/불포함 구조화 입력에서 약관·취소·예약금 장문 이후는 잘라 내어 `register-lottetour-basic` 파서 오염을 막는다(SSOT: `docs/body-parser-lottetour-ssot.md`). */
export function clipLottetourIncExcInputForParse(blob: string): string {
  const lines = blob.split('\n')
  const out: string[] = []
  for (const line of lines) {
    const t = line.replace(/\s+/g, ' ').trim()
    if (/^포함\s*\/\s*불포함\s*\/\s*약관/i.test(t)) break
    if (/^핵심정보$/i.test(t)) break
    if (/^리뷰\s*\(/i.test(t)) break
    if (/^여행\s*일정$/i.test(t)) break
    if (/^약관\s*[\/／]\s*취소수수료/i.test(t)) break
    if (/^약관\s*\/\s*취소수수료/i.test(t)) break
    if (/^약관\s*\/\s*취소\s*수수료/i.test(t)) break
    if (/약관\s*\/\s*취소수수료\s*더\s*보기/i.test(t)) break
    if (/^■\s*약관\b/i.test(t)) break
    if (/^■\s*취소수수료\b/i.test(t)) break
    if (/^■\s*예약금\s*규정/i.test(t)) break
    if (/^■\s*최저출발인원/i.test(t)) break
    if (/^■\s*항공\s*규정/i.test(t)) break
    if (/^■\s*기간에\s*따른/i.test(t)) break
    if (/^■\s*감염병/i.test(t)) break
    if (/^#\s*약관\b/i.test(t)) break
    if (/^롯데관광\s*약관/i.test(t)) break
    if (/^행사\s*약관/i.test(t)) break
    out.push(line)
  }
  return out.join('\n').trim()
}

function extractLottetourBodyExtractFromNormalizedRaw(normalizedRaw: string): NonNullable<
  DetailBodyParseSnapshot['raw']['lottetourBodyExtract']
> {
  const god =
    normalizedRaw.match(/\/evtList\/\d+\/\d+\/\d+\/\d+[^\n\r?#]*\?[^\n\r#]*godId=(\d+)/i)?.[1]?.trim() ??
    normalizedRaw.match(/[?&]godId=(\d+)/i)?.[1]?.trim() ??
    normalizedRaw.match(/\bgodId\s*[:：=]\s*(\d{4,})\b/i)?.[1]?.trim() ??
    null
  const evt =
    normalizedRaw.match(/[?&]evtCd=([^&\s#'"<>]+)/i)?.[1]?.trim() ??
    normalizedRaw.match(/\bevtCd\s*[:：=]\s*([A-Za-z0-9_-]{8,34})\b/i)?.[1]?.trim() ??
    normalizedRaw.match(/evtCd=([A-Z]\d{2}[A-Z]\d{6}[A-Z]{2}\d{3})\b/i)?.[1]?.trim() ??
    null
  const menuDetail = normalizedRaw.match(/\/evtDetail\/(\d+)\/(\d+)\/(\d+)\/(\d+)/i)
  const menuList = normalizedRaw.match(/\/evtList\/(\d+)\/(\d+)\/(\d+)\/(\d+)/i)
  const menu = menuDetail ?? menuList
  const categoryMenuNo =
    menu?.[1] && menu[2] && menu[3] && menu[4]
      ? { no1: menu[1]!, no2: menu[2]!, no3: menu[3]!, no4: menu[4]! }
      : null
  const meetingPlaceRaw =
    normalizedRaw.match(/미팅\s*장소\s*[:：]?\s*([^\n\r]{2,160})/i)?.[1]?.trim() ??
    normalizedRaw.match(/집결\s*(?:장소|지)\s*[:：]?\s*([^\n\r]{2,160})/i)?.[1]?.trim() ??
    null
  const seatUpgradeLines: string[] = []
  for (const ln of normalizedRaw.split(/\r?\n/)) {
    const t = ln.replace(/\s+/g, ' ').trim()
    if (!t) continue
    if (/좌석\s*승급|승급\s*옵션|좌석\s*업그레이드|업그레이드\s*좌석/i.test(t) && t.length < 220) {
      seatUpgradeLines.push(t)
    }
    if (seatUpgradeLines.length >= 14) break
  }
  return {
    godId: god,
    evtCd: evt,
    categoryMenuNo,
    meetingPlaceRaw: meetingPlaceRaw || null,
    seatUpgradeLines: seatUpgradeLines.length ? seatUpgradeLines : null,
  }
}

export function parseDetailBodyStructuredLottetour(input: {
  rawText: string
  hotelRaw?: string | null
  optionalRaw?: string | null
  shoppingRaw?: string | null
}): DetailBodyParseSnapshot {
  const normalizedRaw = normalizeDetailRawText(input.rawText)
  const sections = splitDetailSections(normalizedRaw)
  const { flightSection, hotelSection, optionalSection, shoppingSection, incExcSection } =
    sliceDetailBodySections(normalizedRaw, sections, {
      hotelRaw: input.hotelRaw,
      optionalRaw: input.optionalRaw,
      shoppingRaw: input.shoppingRaw,
    })

  const flightStructured = emptyFlightStructured()
  const hotelStructured = parseHotelSectionLottetour(hotelSection)
  const optionalToursStructured = emptyOptionalToursStructured()
  const shoppingStructured = emptyShoppingStructured()
  const incExcForParse = clipLottetourIncExcInputForParse(incExcSection)
  let includedExcludedStructured = parseLottetourIncludedExcludedSection(incExcForParse)
  if (
    includedExcludedStructured.includedItems.length === 0 &&
    includedExcludedStructured.excludedItems.length === 0 &&
    /포함\s*사항/i.test(normalizedRaw) &&
    /불포함\s*사항/i.test(normalizedRaw)
  ) {
    includedExcludedStructured = parseLottetourIncludedExcludedSection(
      clipLottetourIncExcInputForParse(normalizedRaw)
    )
  }

  const { review, sectionReview, qualityScores, failurePatterns } = buildDetailReviewPolicyLottetour({
    sections,
    flightStructured,
    hotelStructured,
    optionalToursStructured,
    shoppingStructured,
    includedExcludedStructured,
    optionalPasteRaw: input.optionalRaw?.trim() || null,
    shoppingPasteRaw: input.shoppingRaw?.trim() || null,
  })

  const lottetourBodyExtract = extractLottetourBodyExtractFromNormalizedRaw(normalizedRaw)

  return {
    normalizedRaw,
    sections,
    review,
    sectionReview,
    qualityScores,
    failurePatterns,
    flightStructured,
    hotelStructured,
    optionalToursStructured,
    shoppingStructured,
    includedExcludedStructured,
    brandKey: 'lottetour',
    raw: {
      hotelPasteRaw: input.hotelRaw?.trim() || null,
      optionalToursPasteRaw: input.optionalRaw?.trim() || null,
      shoppingPasteRaw: input.shoppingRaw?.trim() || null,
      flightRaw: flightSection.trim() || null,
      lottetourBodyExtract,
    },
  }
}
