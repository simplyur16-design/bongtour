/**
 * 하나투어(hanatour) 관리자 등록 — **본문 축** 스냅샷만 조립한다.
 *
 * 담당: 정규화, 트리플/포함불포함·일정·호텔 슬라이스, 호텔 표 구조화, 예약현황 한 줄(`raw.hanatourReservationStatus`) 추출,
 * 일정 섹션 원료 thinning. 일차 배열 `schedule`는 만들지 않는다.
 *
 * **비담당(SSOT = 입력 파서):** 항공·선택관광·쇼핑 구조화 — `register-input-parse-hanatour` + `register-parse-hanatour` 정형칸.
 * 본문 동일 문구로 여기서 `flightStructured` 등을 채우지 않는다.
 *
 * @see docs/body-parser-hanatour-ssot.md
 *
 * 상위 규약: `docs/admin-register-supplier-precise-spec.md` §3. 일정 표현: `docs/register_schedule_expression_ssot.md`.
 */
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser-types'
import {
  emptyFlightStructured,
  emptyOptionalToursStructured,
  emptyShoppingStructured,
} from '@/lib/detail-body-parser-input-axis-stubs'
import {
  extractHanatourReservationStatusFromNormalized,
  normalizeDetailRawText,
  sliceDetailBodySections,
  splitDetailSections,
  thinHanatourSplitScheduleSections,
} from '@/lib/detail-body-parser-utils-hanatour'
import { parseHanatourIncludedExcludedStructured } from '@/lib/hanatour-basic-info-body-extract'
import { parseHotelSectionHanatour } from '@/lib/hotel-parser-hanatour'
import { buildDetailReviewPolicyHanatour } from '@/lib/review-policy-hanatour'

export function parseDetailBodyStructuredHanatour(input: {
  rawText: string
  hotelRaw?: string | null
  optionalRaw?: string | null
  shoppingRaw?: string | null
}): DetailBodyParseSnapshot {
  const normalizedRaw = normalizeDetailRawText(input.rawText)
  const sections = thinHanatourSplitScheduleSections(splitDetailSections(normalizedRaw))
  const hanatourReservationStatus = extractHanatourReservationStatusFromNormalized(normalizedRaw)
  const { flightSection, hotelSection, optionalSection, shoppingSection, incExcSection } =
    sliceDetailBodySections(normalizedRaw, sections, {
      hotelRaw: input.hotelRaw,
      optionalRaw: input.optionalRaw,
      shoppingRaw: input.shoppingRaw,
    })

  const flightStructured = emptyFlightStructured()
  const hotelStructured = parseHotelSectionHanatour(hotelSection)
  const optionalToursStructured = emptyOptionalToursStructured()
  const shoppingStructured = emptyShoppingStructured()
  const includedExcludedStructured = parseHanatourIncludedExcludedStructured(incExcSection, normalizedRaw)

  const { review, sectionReview, qualityScores, failurePatterns } = buildDetailReviewPolicyHanatour({
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
    brandKey: 'hanatour',
    raw: {
      hotelPasteRaw: input.hotelRaw?.trim() || null,
      optionalToursPasteRaw: input.optionalRaw?.trim() || null,
      shoppingPasteRaw: input.shoppingRaw?.trim() || null,
      flightRaw: flightSection.trim() || null,
      hanatourReservationStatus,
    },
  }
}
