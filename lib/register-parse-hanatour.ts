/**
 * 하나투어 전용 등록 파싱 orchestration.
 *
 * **책임 분리:** `parseDetailBodyStructuredHanatour`는 본문 슬라이스·호텔·포함불포함·예약 한 줄 추출 등만 한다.
 * 항공·옵션·쇼핑 **구조화**는 `register-input-parse-hanatour`로, **정형 입력란**만 기준으로 한다.
 *
 * @see docs/body-parser-hanatour-ssot.md
 *
 * 상위 입력 규약: `docs/admin-register-supplier-precise-spec.md` §3. 일정 표현: `docs/register_schedule_expression_ssot.md`.
 */
import { parseDetailBodyStructuredHanatour } from '@/lib/detail-body-parser-hanatour'
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser'
import { parseForRegisterLlmHanatour } from '@/lib/register-from-llm-hanatour'
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'
import { resolveDirectedFlightLinesHanatour } from '@/lib/register-flight-hanatour'
import {
  parseHanatourFlightInput,
  parseHanatourOptionalInput,
  parseHanatourShoppingInput,
} from '@/lib/register-input-parse-hanatour'
import { buildDetailReviewPolicyHanatour } from '@/lib/review-policy-hanatour'
import { applyHanatourBasicInfoBodyExtract } from '@/lib/hanatour-basic-info-body-extract'
import { sanitizeHanatourRegisterParsedDepartureFields } from '@/lib/hanatour-departure-flight-display'
import { finalizeHanatourRegisterParsedPricing } from '@/lib/register-hanatour-price'
import { finalizeHanatourRegisterParsedShopping } from '@/lib/register-hanatour-shopping'

type ParseOpts = NonNullable<Parameters<typeof parseForRegisterLlmHanatour>[2]>

/** 본문 `상품코드` / `상품번호` + JKP… 형태 */
function extractHanatourOriginProductCodeFromBlob(blob: string): string | null {
  const t = blob.replace(/\s+/g, ' ').trim()
  const m =
    t.match(/상품(?:코드|번호)\s*[:：]?\s*([A-Za-z]{1,6}\d[A-Za-z0-9-]{4,})/i) ||
    t.match(/상품번호\s*([A-Za-z]{1,6}\d[A-Za-z0-9-]{4,})/i)
  return m?.[1]?.trim() ?? null
}

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

function refreshHanatourDetailBodyPolicy(detailBody: DetailBodyParseSnapshot): DetailBodyParseSnapshot {
  const policy = buildDetailReviewPolicyHanatour({
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

function withHanatourFlightStructured(
  detailBody: DetailBodyParseSnapshot,
  flightStructured: DetailBodyParseSnapshot['flightStructured']
): DetailBodyParseSnapshot {
  return refreshHanatourDetailBodyPolicy({ ...detailBody, flightStructured })
}

/** 정형 항공칸 병합 후 flightRaw·flightStructured·검수(sectionReview) 정합 */
function applyHanatourMergedFlightRawToStructured(detailBody: DetailBodyParseSnapshot): DetailBodyParseSnapshot {
  const fr = detailBody.raw.flightRaw?.trim()
  if (!fr) return detailBody
  const flightStructured = parseHanatourFlightInput(fr, detailBody.normalizedRaw)
  return withHanatourFlightStructured(detailBody, flightStructured)
}

export const HANATOUR_PRICE_SLOT_SSOT_NOTE =
  '하나투어 가격표(3슬롯): adultPrice=성인, childExtraBedPrice=아동 단가, childNoBedPrice=미사용(null), infantPrice=유아. 유류·제세·기본상품가 안내·잔여석 등 메타 줄은 슬롯에 넣지 않습니다.'

export const HANATOUR_FLIGHT_PREVIEW_NOTE =
  '하나투어 항공: 항공 입력란이 있으면 그 값만으로 flightStructured를 만듭니다(본문 캠페인 문구와 분리). 입력란이 없을 때만 본문 flightRaw로 구조화합니다.'

export async function parseForRegisterHanatour(
  rawText: string,
  originSource?: string,
  options?: ParseOpts
): Promise<RegisterParsed> {
  let detailBody = parseDetailBodyStructuredHanatour({
    rawText,
    hotelRaw: options?.pastedBlocks?.hotel ?? null,
    optionalRaw: options?.pastedBlocks?.optionalTour ?? null,
    shoppingRaw: options?.pastedBlocks?.shopping ?? null,
  })
  detailBody = mergeAirlineTransportPaste(detailBody, options?.pastedBlocks?.airlineTransport?.trim())
  const airlinePasteOnly = options?.pastedBlocks?.airlineTransport?.trim()
  if (airlinePasteOnly) {
    /** 항공 입력란만으로 구조화 — 본문 캠페인·요약이 항공사명을 가리지 않게 */
    detailBody = withHanatourFlightStructured(
      detailBody,
      parseHanatourFlightInput(airlinePasteOnly, null)
    )
  } else {
    detailBody = applyHanatourMergedFlightRawToStructured(detailBody)
  }

  const optPaste = options?.pastedBlocks?.optionalTour?.trim() ?? ''
  const shopPaste = options?.pastedBlocks?.shopping?.trim() || null
  detailBody = refreshHanatourDetailBodyPolicy({
    ...detailBody,
    optionalToursStructured: parseHanatourOptionalInput(optPaste),
    shoppingStructured: parseHanatourShoppingInput('', shopPaste),
  })
  if (/선택관광\s*없음/i.test(detailBody.normalizedRaw) && detailBody.optionalToursStructured.rows.length > 0) {
    detailBody = {
      ...detailBody,
      review: {
        ...detailBody.review,
        info: [
          ...detailBody.review.info,
          '상단 선택관광없음 표기와 옵션 입력란 구조화가 불일치할 수 있음',
        ],
      },
    }
  }
  if (
    /쇼핑\s*1\s*회|쇼핑\s*\d+\s*회/i.test(detailBody.normalizedRaw.split('\n').slice(0, 12).join('\n')) &&
    detailBody.shoppingStructured.rows.length > 1
  ) {
    detailBody = {
      ...detailBody,
      review: {
        ...detailBody.review,
        info: [
          ...detailBody.review.info,
          '상단 쇼핑 횟수 요약과 쇼핑 입력란 행 수가 다를 수 있음(입력란·표 우선)',
        ],
      },
    }
  }

  let parsed = await parseForRegisterLlmHanatour(rawText, originSource, {
    ...options,
    presetDetailBody: detailBody,
    resolveDirectedFlightLines: resolveDirectedFlightLinesHanatour,
    /** 정형 파서(detailBody)가 표·항공을 이미 구조화 — 섹션별 repair generateContent 연속 호출 생략 */
    skipDetailSectionGeminiRepairs: true,
    /** confirm 이중 LLM(일정 선추출+메인) 축소 — 기본 일정은 메인 JSON 한 번에서만 */
    skipScheduleExtractLlm: options?.skipScheduleExtractLlm ?? true,
  })
  parsed = applyHanatourBasicInfoBodyExtract(parsed, detailBody.normalizedRaw ?? '')
  parsed = sanitizeHanatourRegisterParsedDepartureFields(parsed, detailBody.normalizedRaw ?? '')
  parsed = finalizeHanatourRegisterParsedPricing(parsed)
  parsed = finalizeHanatourRegisterParsedShopping(parsed)

  const hCode = extractHanatourOriginProductCodeFromBlob(rawText)
  if (hCode && !(parsed.originCode ?? '').trim()) {
    parsed = { ...parsed, originCode: hCode }
  }

  const prevNotes = parsed.registerPreviewPolicyNotes ?? []
  const extra: string[] = []
  if (!prevNotes.some((n) => n.includes('하나투어 가격표(3슬롯)'))) extra.push(HANATOUR_PRICE_SLOT_SSOT_NOTE)
  if (!prevNotes.some((n) => n.includes('하나투어 항공:'))) extra.push(HANATOUR_FLIGHT_PREVIEW_NOTE)
  if (extra.length) {
    parsed = { ...parsed, registerPreviewPolicyNotes: [...prevNotes, ...extra] }
  }

  return parsed
}

export type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'
