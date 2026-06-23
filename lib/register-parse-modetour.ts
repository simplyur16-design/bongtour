/**
 * 모두투어 전용 등록 파싱 orchestration.
 *
 * **책임 분리:** `parseDetailBodyStructuredModetour`는 본문 슬라이스·호텔·포함불포함만 책운다.
 * 항공·옵션·쇼핑 **구조화**는 `register-input-parse-modetour`로 **정형 입력란**만 기준으로 한다.
 * detail-body → flightRaw 확장·directed resolver는 항공 입력 파서 층과 병행.
 *
 * @see docs/body-parser-modetour-ssot.md
 *
 * 상위 규약: `docs/admin-register-supplier-precise-spec.md` §1. 일정 표현: `docs/register_schedule_expression_ssot.md`.
 */
import { parseDetailBodyStructuredModetour } from '@/lib/detail-body-parser-modetour'
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser'
import {
  expandModetourFlightRawForDirectedParse,
  resolveModetourDirectedDepartureReturnLines,
} from '@/lib/register-modetour-flight'
import {
  parseModetourFlightInput,
  parseModetourOptionalInput,
  parseModetourShoppingInput,
} from '@/lib/register-input-parse-modetour'
import { parseForRegisterLlmModetour } from '@/lib/register-from-llm-modetour'
import type { RegisterParsed } from '@/lib/register-llm-schema-modetour'
import { stripCounselingTermsFromScheduleRow } from '@/lib/itinerary-counseling-terms-strip'
import { finalizeModetourRegisterParsedPricing } from '@/lib/register-modetour-price'
import { finalizeModetourRegisterParsedShopping } from '@/lib/register-modetour-shopping'
import { supplementModetourScheduleFromPastedBody } from '@/lib/register-modetour-pasted-schedule'
import { buildDetailReviewPolicyModetour } from '@/lib/review-policy-modetour'
import { applyModetourBasicInfoMustKnowExtract } from '@/lib/modetour-basic-info-must-know-extract'

type ParseOpts = NonNullable<Parameters<typeof parseForRegisterLlmModetour>[2]>

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

function refreshModetourDetailBodyPolicy(detailBody: DetailBodyParseSnapshot): DetailBodyParseSnapshot {
  const policy = buildDetailReviewPolicyModetour({
    sections: detailBody.sections,
    flightStructured: detailBody.flightStructured,
    hotelStructured: detailBody.hotelStructured,
    optionalToursStructured: detailBody.optionalToursStructured,
    shoppingStructured: detailBody.shoppingStructured,
    includedExcludedStructured: detailBody.includedExcludedStructured,
    optionalPasteRaw: detailBody.raw.optionalToursPasteRaw,
    shoppingPasteRaw: detailBody.raw.shoppingPasteRaw,
  })
  return {
    ...detailBody,
    review: policy.review,
    sectionReview: policy.sectionReview,
    qualityScores: policy.qualityScores,
    failurePatterns: policy.failurePatterns,
  }
}

function withModetourFlightStructured(
  detailBody: DetailBodyParseSnapshot,
  flightStructured: DetailBodyParseSnapshot['flightStructured']
): DetailBodyParseSnapshot {
  return refreshModetourDetailBodyPolicy({ ...detailBody, flightStructured })
}

/** 항공 정형칸 병합 후 `flightRaw`와 `flightStructured`·검수(sectionReview)가 어긋나지 않게 맞춘다. */
function applyModetourMergedFlightRawToStructured(detailBody: DetailBodyParseSnapshot): DetailBodyParseSnapshot {
  const fr = detailBody.raw.flightRaw?.trim()
  if (!fr) return detailBody
  const flightStructured = parseModetourFlightInput(fr, detailBody.normalizedRaw)
  return withModetourFlightStructured(detailBody, flightStructured)
}

export async function parseForRegisterModetour(
  rawText: string,
  originSource?: string,
  options?: ParseOpts
): Promise<RegisterParsed> {
  // REGRESSION-FREEZE[register-admin-no-pasted-blocks-ssot]: 항공·옵션·쇼핑·호텔 정형칸 폐기 — detail-collect API SSOT
  let detailBody = parseDetailBodyStructuredModetour({
    rawText,
    hotelRaw: null,
    optionalRaw: null,
    shoppingRaw: null,
  })
  detailBody = expandModetourFlightRawForDirectedParse(detailBody)
  detailBody = applyModetourMergedFlightRawToStructured(detailBody)
  detailBody = refreshModetourDetailBodyPolicy({
    ...detailBody,
    optionalToursStructured: parseModetourOptionalInput(''),
    shoppingStructured: parseModetourShoppingInput('', null),
  })

  const parsed = await parseForRegisterLlmModetour(rawText, originSource, {
    ...options,
    presetDetailBody: detailBody,
    resolveDirectedFlightLines: resolveModetourDirectedDepartureReturnLines,
  })
  const parsedWithSchedule = supplementModetourScheduleFromPastedBody(parsed, rawText)
  const priced = finalizeModetourRegisterParsedPricing(parsedWithSchedule)
  const shopped = finalizeModetourRegisterParsedShopping(priced)
  const withScheduleCounseling =
    shopped.schedule?.length && shopped.schedule.length > 0
      ? { ...shopped, schedule: shopped.schedule.map(stripCounselingTermsFromScheduleRow) }
      : shopped
  const norm = withScheduleCounseling.detailBodyStructured?.normalizedRaw?.trim() || rawText.trim()
  return applyModetourBasicInfoMustKnowExtract(withScheduleCounseling, norm)
}

export type { RegisterParsed } from '@/lib/register-llm-schema-modetour'
