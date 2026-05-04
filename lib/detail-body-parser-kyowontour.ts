/**
 * 교보이지(kyowontour) 관리자 등록 — **본문 축** 스냅샷만 조립한다.
 *
 * 담당: 본문 정규화, 섹션 앵커·분리·슬라이스, 호텔 본문 구조화, 포함/불포함, `raw.flightRaw` 등 슬라이스 원료,
 * 약관/예약금 경계(클립). 일정 원료는 섹션 텍스트로만 남기고 일차 배열화는 하지 않는다.
 *
 * **비담당(SSOT = 입력 파서):** 항공·선택관광/옵션·쇼핑 구조화 — `register-input-parse-kyowontour` 및
 * `register-parse-kyowontour`의 정형 입력란만이 구조화한다. 본문에 동일 문구가 있어도 여기서는 채우지 않는다.
 *
 * @see docs/body-parser-ybtour-ssot.md — 교보이지(kyowontour) 등록 본문 파싱은 동일 SSOT 규약을 적용한다.
 *
 * 상위 규약: `docs/admin-register-supplier-precise-spec.md` §4. 일정 표현: `docs/register_schedule_expression_ssot.md`.
 */
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser-types'
import {
  emptyFlightStructured,
  emptyOptionalToursStructured,
  emptyShoppingStructured,
} from '@/lib/detail-body-parser-input-axis-stubs'
import { normalizeDetailRawText, splitDetailSections, sliceDetailBodySections } from '@/lib/detail-body-parser-utils-kyowontour'
import { parseHotelSectionKyowontour } from '@/lib/hotel-parser-kyowontour'
import { parseKyowontourIncludedExcludedSection } from '@/lib/register-kyowontour-basic'
import { buildDetailReviewPolicyKyowontour } from '@/lib/review-policy-kyowontour'

/** 포함/불포함 구조화 입력에서 약관·취소·예약금 장문 이후는 잘라 내어 `register-kyowontour-basic` 파서 오염을 막는다(SSOT: ybtour 문서와 동일 규약 — `docs/body-parser-ybtour-ssot.md`). */
export function clipKyowontourIncExcInputForParse(blob: string): string {
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
    out.push(line)
  }
  return out.join('\n').trim()
}

export function parseDetailBodyStructuredKyowontour(input: {
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
  const hotelStructured = parseHotelSectionKyowontour(hotelSection)
  const optionalToursStructured = emptyOptionalToursStructured()
  const shoppingStructured = emptyShoppingStructured()
  const incExcForParse = clipKyowontourIncExcInputForParse(incExcSection)
  let includedExcludedStructured = parseKyowontourIncludedExcludedSection(incExcForParse)
  if (
    includedExcludedStructured.includedItems.length === 0 &&
    includedExcludedStructured.excludedItems.length === 0 &&
    /포함\s*사항/i.test(normalizedRaw) &&
    /불포함\s*사항/i.test(normalizedRaw)
  ) {
    includedExcludedStructured = parseKyowontourIncludedExcludedSection(
      clipKyowontourIncExcInputForParse(normalizedRaw)
    )
  }

  const { review, sectionReview, qualityScores, failurePatterns } = buildDetailReviewPolicyKyowontour({
    sections,
    flightStructured,
    hotelStructured,
    optionalToursStructured,
    shoppingStructured,
    includedExcludedStructured,
    optionalPasteRaw: input.optionalRaw?.trim() || null,
    shoppingPasteRaw: input.shoppingRaw?.trim() || null,
  })

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
    brandKey: 'kyowontour',
    raw: {
      hotelPasteRaw: input.hotelRaw?.trim() || null,
      optionalToursPasteRaw: input.optionalRaw?.trim() || null,
      shoppingPasteRaw: input.shoppingRaw?.trim() || null,
      flightRaw: flightSection.trim() || null,
    },
  }
}
