/**
 * 교보이지 전용 등록 파싱 orchestration.
 *
 * **책임 분리:** `parseDetailBodyStructuredKyowontour`는 본문 슬라이스·호텔·포함불포함만 책운다.
 * 항공·옵션·쇼핑 **구조화**는 이 파일에서 `register-input-parse-kyowontour`로, **정형 입력란**(`pastedBlocks`) 기준으로만 수행한다.
 * 본문에 같은 표가 있어도 입력란이 비어 있으면 해당 축은 비어 있을 수 있다.
 *
 * @see docs/body-parser-ybtour-ssot.md — 교보이지(kyowontour) 등록 본문 파싱은 동일 SSOT 규약.
 *
 * 상위 규약: `docs/admin-register-supplier-precise-spec.md` §4. 일정 표현: `docs/register_schedule_expression_ssot.md`.
 */
import { parseDetailBodyStructuredKyowontour } from '@/lib/detail-body-parser-kyowontour'
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser'
import { parseForRegisterLlmKyowontour } from '@/lib/register-from-llm-kyowontour'
import type { RegisterParsed } from '@/lib/register-llm-schema-kyowontour'
import { resolveDirectedFlightLinesKyowontour } from '@/lib/register-flight-kyowontour'
import {
  parseKyowontourFlightInput,
  parseKyowontourOptionalInput,
  parseKyowontourShoppingInput,
} from '@/lib/register-input-parse-kyowontour'
import { buildDetailReviewPolicyKyowontour } from '@/lib/review-policy-kyowontour'
import { finalizeKyowontourRegisterParsedPricing } from '@/lib/register-kyowontour-price'
import { finalizeKyowontourRegisterParsedShopping } from '@/lib/register-kyowontour-shopping'
import {
  applyKyowontourStructuredPreviewFields,
  extractKyowontourProductCodeFromBlob,
  logKyowontourBasicDetailBody,
  logKyowontourBasicRegisterFinal,
} from '@/lib/register-kyowontour-basic'
import { sanitizeKyowontourRegisterParsedStrings } from '@/lib/register-kyowontour-text-sanitize'
import { applyKyowontourBasicInfoMustKnowExtract } from '@/lib/kyowontour-basic-info-must-know-extract'

type ParseOpts = NonNullable<Parameters<typeof parseForRegisterLlmKyowontour>[2]>

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

function refreshKyowontourDetailBodyPolicy(detailBody: DetailBodyParseSnapshot): DetailBodyParseSnapshot {
  const policy = buildDetailReviewPolicyKyowontour({
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

function withKyowontourFlightStructured(
  detailBody: DetailBodyParseSnapshot,
  flightStructured: DetailBodyParseSnapshot['flightStructured']
): DetailBodyParseSnapshot {
  return refreshKyowontourDetailBodyPolicy({ ...detailBody, flightStructured })
}

function applyKyowontourMergedFlightRawToStructured(detailBody: DetailBodyParseSnapshot): DetailBodyParseSnapshot {
  const fr = detailBody.raw.flightRaw?.trim()
  if (!fr) return detailBody
  const flightStructured = parseKyowontourFlightInput(fr, detailBody.normalizedRaw)
  return withKyowontourFlightStructured(detailBody, flightStructured)
}

export const KYOWONTOUR_PRICE_SLOT_SSOT_NOTE =
  '교보이지 가격(3슬롯): adultPrice=성인, childExtraBedPrice=아동 단가, childNoBedPrice=null, infantPrice=유아. 쿠폰·총액·잔여석·출발일변경·적립·무이자 등은 슬롯에 넣지 않습니다.'

export const KYOWONTOUR_FLIGHT_PREVIEW_NOTE =
  '교보이지 항공: 정형칸 병합 후 flightStructured를 재계산합니다. 출발/도착 블록에서 항공사(첫 줄)·편명·도시·일시를 구조화합니다.'

export async function parseForRegisterKyowontour(
  rawText: string,
  originSource?: string,
  options?: ParseOpts
): Promise<RegisterParsed> {
  const osPrev = (originSource ?? '').trim().slice(0, 100)
  console.log(
    `[kyowontour] phase=parse-for-register entry fn=parseForRegisterKyowontour originSource_preview=${JSON.stringify(osPrev)} rawText_len=${rawText?.length ?? 0}`
  )
  let detailBody = parseDetailBodyStructuredKyowontour({
    rawText,
    hotelRaw: options?.pastedBlocks?.hotel ?? null,
    optionalRaw: options?.pastedBlocks?.optionalTour ?? null,
    shoppingRaw: options?.pastedBlocks?.shopping ?? null,
  })
  detailBody = mergeAirlineTransportPaste(detailBody, options?.pastedBlocks?.airlineTransport?.trim())
  const airlinePasteOnly = options?.pastedBlocks?.airlineTransport?.trim()
  if (airlinePasteOnly) {
    detailBody = withKyowontourFlightStructured(detailBody, parseKyowontourFlightInput(airlinePasteOnly, null))
  } else {
    detailBody = applyKyowontourMergedFlightRawToStructured(detailBody)
  }
  const optPaste = options?.pastedBlocks?.optionalTour?.trim() ?? ''
  const shopPaste = options?.pastedBlocks?.shopping?.trim() || null
  detailBody = refreshKyowontourDetailBodyPolicy({
    ...detailBody,
    optionalToursStructured: parseKyowontourOptionalInput(optPaste),
    shoppingStructured: parseKyowontourShoppingInput('', shopPaste),
  })
  logKyowontourBasicDetailBody(detailBody, rawText?.length ?? 0)

  let parsed = await parseForRegisterLlmKyowontour(rawText, originSource, {
    ...options,
    presetDetailBody: detailBody,
    resolveDirectedFlightLines: resolveDirectedFlightLinesKyowontour,
  })
  parsed = finalizeKyowontourRegisterParsedPricing(parsed)
  parsed = finalizeKyowontourRegisterParsedShopping(parsed)
  parsed = applyKyowontourStructuredPreviewFields(parsed)

  const ybCode = extractKyowontourProductCodeFromBlob(rawText)
  if (ybCode && !(parsed.originCode ?? '').trim()) {
    parsed = { ...parsed, originCode: ybCode }
  }
  logKyowontourBasicRegisterFinal(parsed, rawText?.length ?? 0)

  const norm = parsed.detailBodyStructured?.normalizedRaw?.trim() || rawText.trim()
  parsed = applyKyowontourBasicInfoMustKnowExtract(parsed, norm)

  const prevNotes = parsed.registerPreviewPolicyNotes ?? []
  const extra: string[] = []
  if (!prevNotes.some((n) => n.includes('교보이지 가격(3슬롯)'))) extra.push(KYOWONTOUR_PRICE_SLOT_SSOT_NOTE)
  if (!prevNotes.some((n) => n.includes('교보이지 항공:'))) extra.push(KYOWONTOUR_FLIGHT_PREVIEW_NOTE)
  if (extra.length) {
    parsed = { ...parsed, registerPreviewPolicyNotes: [...prevNotes, ...extra] }
  }

  parsed = sanitizeKyowontourRegisterParsedStrings(parsed)
  return parsed
}

export type { RegisterParsed } from '@/lib/register-llm-schema-kyowontour'
