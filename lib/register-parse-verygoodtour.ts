/**
 * 참좋은여행 전용 등록 파싱 orchestration.
 * 가격 3슬롯 정리는 `register-verygoodtour-price`에서만 수행.
 *
 * **책임 분리:** `parseDetailBodyStructuredVerygoodtour`는 본문 슬라이스·호텔·포함불포함만 책운다.
 * 항공·옵션·쇼핑 **구조화**는 `register-input-parse-verygoodtour`로 **정형 입력란**만 기준으로 한다.
 *
 * @see docs/body-parser-verygoodtour-ssot.md
 *
 * 상위 규약: `docs/admin-register-supplier-precise-spec.md` §2. 일정 표현: `docs/register_schedule_expression_ssot.md`.
 */
import { parseDetailBodyStructuredVerygoodtour } from '@/lib/detail-body-parser-verygoodtour'
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser'
import { normalizeVerygoodFlightSectionDecorators } from '@/lib/flight-parser-verygoodtour'
import {
  parseVerygoodtourFlightInput,
  parseVerygoodtourOptionalInput,
  parseVerygoodtourShoppingInput,
} from '@/lib/register-input-parse-verygoodtour'
import { parseForRegisterLlmVerygoodtour } from '@/lib/register-from-llm-verygoodtour'
import type { RegisterParsed } from '@/lib/register-llm-schema-verygoodtour'
import { resolveDirectedFlightLinesVerygoodtour } from '@/lib/register-flight-verygoodtour'
import { buildDetailReviewPolicyVerygoodtour } from '@/lib/review-policy-verygoodtour'
import { finalizeVerygoodRegisterParsedPricing } from '@/lib/register-verygoodtour-price'
import { finalizeVerygoodRegisterParsedShopping } from '@/lib/register-verygoodtour-shopping'
import {
  clipVerygoodMarketingTailFromPaste,
  VERYGOOD_LLM_INPUT_CLIP_REVISION,
} from '@/lib/verygoodtour-schedule-recovery-clip'
import { normalizeVerygoodRegisterPasteLineEndings } from '@/lib/verygoodtour-paste-normalize-for-register-verygoodtour'

type ParseOpts = NonNullable<Parameters<typeof parseForRegisterLlmVerygoodtour>[2]>

/** 스냅샷·캐시 키 설계 시 `inputDigest`와 함께 올릴 LLM 입력 clip revision */
export { VERYGOOD_LLM_INPUT_CLIP_REVISION }

function mergeAirlineTransportPaste(
  detailBody: DetailBodyParseSnapshot,
  airlinePaste: string | undefined
): DetailBodyParseSnapshot {
  if (!airlinePaste) return detailBody
  return {
    ...detailBody,
    raw: {
      ...detailBody.raw,
      flightRaw: [detailBody.raw.flightRaw, airlinePaste].filter(Boolean).join('\n\n'),
    },
  }
}

const VERYGOOD_ABSENCE = {
  hotelEmptyWhenNoReviewOk: true,
  optionalEmptyWhenNoReviewOk: true,
  shoppingEmptyWhenNoReviewOk: true,
} as const

function refreshVerygoodDetailBodyPolicy(detailBody: DetailBodyParseSnapshot): DetailBodyParseSnapshot {
  const policy = buildDetailReviewPolicyVerygoodtour({
    sections: detailBody.sections,
    flightStructured: detailBody.flightStructured,
    hotelStructured: detailBody.hotelStructured,
    optionalToursStructured: detailBody.optionalToursStructured,
    shoppingStructured: detailBody.shoppingStructured,
    includedExcludedStructured: detailBody.includedExcludedStructured,
    optionalPasteRaw: detailBody.raw.optionalToursPasteRaw,
    shoppingPasteRaw: detailBody.raw.shoppingPasteRaw,
    absenceTolerances: VERYGOOD_ABSENCE,
  })
  return {
    ...detailBody,
    review: policy.review,
    sectionReview: policy.sectionReview,
    qualityScores: policy.qualityScores,
    failurePatterns: policy.failurePatterns,
  }
}

function withVerygoodFlightStructured(
  detailBody: DetailBodyParseSnapshot,
  flightStructured: DetailBodyParseSnapshot['flightStructured'],
  flightRawPersist: string | null
): DetailBodyParseSnapshot {
  const next: DetailBodyParseSnapshot = {
    ...detailBody,
    flightStructured,
    raw: flightRawPersist != null ? { ...detailBody.raw, flightRaw: flightRawPersist } : detailBody.raw,
  }
  return refreshVerygoodDetailBodyPolicy(next)
}

/** 미리보기·productDraft에서 동일 문구로 3슬롯 의미 고정 */
export const VERYGOOD_PRICE_SLOT_SSOT_NOTE =
  '참좋은 가격표(3슬롯): adultPrice=성인, childExtraBedPrice=아동 단가(엑베·노베 미분리), childNoBedPrice=미사용(null), infantPrice=유아. 가이드경비·잔여석·쿠폰 줄은 본가 슬롯에 넣지 않습니다.'
const VG_FLIGHT_PREVIEW_NOTE =
  '참좋은 항공 구조화 SSOT: 관리자 항공·교통 정형 입력란(airlineTransport)만. 본문에서 잘라낸 항공 구간(raw.flightRaw)은 경계·검수 참고용이며 flightStructured를 채우지 않습니다. 옵션·쇼핑도 각 정형칸만.'

export async function parseForRegisterVerygoodtour(
  rawText: string,
  originSource?: string,
  options?: ParseOpts
): Promise<RegisterParsed> {
  const bodyForParse = rawText.trim()
    ? clipVerygoodMarketingTailFromPaste(normalizeVerygoodRegisterPasteLineEndings(rawText.trim())).clipped
    : ''
  let detailBody = parseDetailBodyStructuredVerygoodtour({
    rawText: bodyForParse || rawText.trim(),
    hotelRaw: options?.pastedBlocks?.hotel ?? null,
    optionalRaw: options?.pastedBlocks?.optionalTour ?? null,
    shoppingRaw: options?.pastedBlocks?.shopping ?? null,
  })
  detailBody = mergeAirlineTransportPaste(detailBody, options?.pastedBlocks?.airlineTransport?.trim())
  const airlinePasteOnly = options?.pastedBlocks?.airlineTransport?.trim()
  if (airlinePasteOnly) {
    const fr =
      normalizeVerygoodFlightSectionDecorators(airlinePasteOnly).trim() || airlinePasteOnly.trim()
    detailBody = withVerygoodFlightStructured(
      detailBody,
      parseVerygoodtourFlightInput(fr, null),
      detailBody.raw.flightRaw
    )
  }
  /** 항공 정형칸이 비면 `flightStructured`는 빈 스냅샷 유지 — 본문 슬라이스로 구조화하지 않음 */

  const optPaste = options?.pastedBlocks?.optionalTour?.trim() ?? ''
  const shopPaste = options?.pastedBlocks?.shopping?.trim() || null
  detailBody = refreshVerygoodDetailBodyPolicy({
    ...detailBody,
    optionalToursStructured: parseVerygoodtourOptionalInput(optPaste),
    shoppingStructured: parseVerygoodtourShoppingInput('', shopPaste),
  })

  let parsed = await parseForRegisterLlmVerygoodtour(bodyForParse || rawText.trim(), originSource, {
    ...options,
    presetDetailBody: detailBody,
    resolveDirectedFlightLines: resolveDirectedFlightLinesVerygoodtour,
  })
  parsed = finalizeVerygoodRegisterParsedPricing(parsed)
  parsed = finalizeVerygoodRegisterParsedShopping(parsed)

  const prevNotes = parsed.registerPreviewPolicyNotes ?? []
  const extra: string[] = []
  if (!prevNotes.some((n) => n.includes('참좋은 가격표(3슬롯)'))) extra.push(VERYGOOD_PRICE_SLOT_SSOT_NOTE)
  if (!prevNotes.some((n) => n.includes('참좋은 항공:'))) extra.push(VG_FLIGHT_PREVIEW_NOTE)
  if (extra.length) {
    parsed = { ...parsed, registerPreviewPolicyNotes: [...prevNotes, ...extra] }
  }

  return parsed
}

export type { RegisterParsed } from '@/lib/register-llm-schema-verygoodtour'
