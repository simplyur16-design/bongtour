/**
 * 참좋은여행(verygoodtour) 관리자 등록 — **본문 축** 스냅샷만 조립한다.
 *
 * 담당: 정규화, 앵커·슬라이스(요약/일정 경계), 호텔 구조화, O포함·O불포함·클립, 노이즈 제거 후처리.
 *
 * **비담당(SSOT = 입력 파서):** 항공·선택관광·쇼핑 구조화 — `register-input-parse-verygoodtour` + `register-parse-verygoodtour`.
 *
 * @see docs/body-parser-verygoodtour-ssot.md
 *
 * 상위 규약: `docs/admin-register-supplier-precise-spec.md` §2. 일정 표현: `docs/register_schedule_expression_ssot.md`.
 */
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser-types'
import {
  emptyFlightStructured,
  emptyOptionalToursStructured,
  emptyShoppingStructured,
} from '@/lib/detail-body-parser-input-axis-stubs'
import {
  normalizeDetailRawText,
  postProcessVerygoodSplitSections,
  splitDetailSections,
  sliceDetailBodySections,
} from '@/lib/detail-body-parser-utils-verygoodtour'
import { parseHotelSectionVerygoodtour } from '@/lib/hotel-parser-verygoodtour'
import { parseVerygoodtourIncludedExcludedSection } from '@/lib/register-verygoodtour-basic'
import { buildDetailReviewPolicyVerygoodtour } from '@/lib/review-policy-verygoodtour'

/** O 포함/불포함 슬라이스가 앵커 누락으로 길게 잡혔을 때 구조화 입력만 잘라 낸다(SSOT: `docs/body-parser-verygoodtour-ssot.md`). */
function clipVerygoodIncExcInputForParse(blob: string): string {
  const lines = blob.split('\n')
  const out: string[] = []
  for (const line of lines) {
    const t = line.replace(/\s+/g, ' ').trim()
    if (/^여행일정\s*변경에\s*관한\s*사전\s*동의/i.test(t)) break
    if (/^■\s*항공\s*$/i.test(t)) break
    if (/^1\s*일차\b/u.test(t)) break
    if (/^일정표/u.test(t) && /호텔|관광지|약관/u.test(t)) break
    out.push(line)
  }
  return out.join('\n').trim()
}

export function parseDetailBodyStructuredVerygoodtour(input: {
  rawText: string
  hotelRaw?: string | null
  optionalRaw?: string | null
  shoppingRaw?: string | null
}): DetailBodyParseSnapshot {
  const normalizedRaw = normalizeDetailRawText(input.rawText)
  const sections = postProcessVerygoodSplitSections(splitDetailSections(normalizedRaw))
  const { flightSection, hotelSection, optionalSection, shoppingSection, incExcSection } =
    sliceDetailBodySections(normalizedRaw, sections, {
      hotelRaw: input.hotelRaw,
      optionalRaw: input.optionalRaw,
      shoppingRaw: input.shoppingRaw,
    })

  const flightStructured = emptyFlightStructured()
  const hotelStructured = parseHotelSectionVerygoodtour(hotelSection)
  const optionalToursStructured = emptyOptionalToursStructured()
  const shoppingStructured = emptyShoppingStructured()
  const incExcForParse = clipVerygoodIncExcInputForParse(incExcSection)
  let includedExcludedStructured = parseVerygoodtourIncludedExcludedSection(incExcForParse)
  if (
    includedExcludedStructured.includedItems.length === 0 &&
    includedExcludedStructured.excludedItems.length === 0 &&
    /O\s*포함사항/i.test(normalizedRaw)
  ) {
    includedExcludedStructured = parseVerygoodtourIncludedExcludedSection(
      clipVerygoodIncExcInputForParse(normalizedRaw)
    )
  }

  const absenceTolerances = {
    hotelEmptyWhenNoReviewOk: true,
    optionalEmptyWhenNoReviewOk: true,
    shoppingEmptyWhenNoReviewOk: true,
  }

  const { review, sectionReview, qualityScores, failurePatterns } = buildDetailReviewPolicyVerygoodtour({
    sections,
    flightStructured,
    hotelStructured,
    optionalToursStructured,
    shoppingStructured,
    includedExcludedStructured,
    optionalPasteRaw: input.optionalRaw?.trim() || null,
    shoppingPasteRaw: input.shoppingRaw?.trim() || null,
    absenceTolerances,
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
    brandKey: 'verygoodtour',
    raw: {
      hotelPasteRaw: input.hotelRaw?.trim() || null,
      optionalToursPasteRaw: input.optionalRaw?.trim() || null,
      shoppingPasteRaw: input.shoppingRaw?.trim() || null,
      /** 본문 슬라이스(경계·검수 참고). `flightStructured` SSOT는 `register-parse-verygoodtour`의 항공 정형칸만. */
      flightRaw: flightSection.trim() || null,
    },
  }
}
