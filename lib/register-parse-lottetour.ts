/**
 * 롯데관광 전용 등록 파싱 orchestration.
 *
 * **책임 분리:** `parseDetailBodyStructuredLottetour`는 본문 슬라이스·호텔·포함불포함만 책운다.
 * 항공·옵션·쇼핑 **구조화**는 이 파일에서 `register-input-parse-lottetour`로, **정형 입력란**(`pastedBlocks`) 기준으로만 수행한다.
 * 본문에 같은 표가 있어도 입력란이 비어 있으면 해당 축은 비어 있을 수 있다.
 *
 * @see docs/body-parser-lottetour-ssot.md — 롯데관광 본문 축 SSOT.
 *
 * 상위 규약: `docs/admin-register-supplier-precise-spec.md` §4. 일정 표현: `docs/register_schedule_expression_ssot.md`.
 */
import { parseDetailBodyStructuredLottetour } from '@/lib/detail-body-parser-lottetour'
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser'
import { parseForRegisterLlmLottetour } from '@/lib/register-from-llm-lottetour'
import type { RegisterParsed } from '@/lib/register-llm-schema-lottetour'
import { resolveDirectedFlightLinesLottetour } from '@/lib/register-flight-lottetour'
import {
  parseLottetourFlightInput,
  parseLottetourOptionalInput,
  parseLottetourShoppingInput,
} from '@/lib/register-input-parse-lottetour'
import { buildDetailReviewPolicyLottetour } from '@/lib/review-policy-lottetour'
import { finalizeLottetourRegisterParsedPricing } from '@/lib/register-lottetour-price'
import { finalizeLottetourRegisterParsedShopping } from '@/lib/register-lottetour-shopping'
import { applyLottetourBasicInfoMustKnowExtract } from '@/lib/lottetour-basic-info-must-know-extract'
import {
  applyLottetourStructuredPreviewFields,
  extractLottetourProductCodeFromBlob,
  logLottetourBasicDetailBody,
  logLottetourBasicRegisterFinal,
  mergeLottetourDetailBodyExtractIntoParsed,
  mergeLottetourMasterIdsFromBlob,
} from '@/lib/register-lottetour-basic'
import { sanitizeLottetourRegisterParsedStrings } from '@/lib/register-lottetour-text-sanitize'

type ParseOpts = NonNullable<Parameters<typeof parseForRegisterLlmLottetour>[2]>

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

function refreshLottetourDetailBodyPolicy(detailBody: DetailBodyParseSnapshot): DetailBodyParseSnapshot {
  const policy = buildDetailReviewPolicyLottetour({
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

function withLottetourFlightStructured(
  detailBody: DetailBodyParseSnapshot,
  flightStructured: DetailBodyParseSnapshot['flightStructured']
): DetailBodyParseSnapshot {
  return refreshLottetourDetailBodyPolicy({ ...detailBody, flightStructured })
}

function applyLottetourMergedFlightRawToStructured(detailBody: DetailBodyParseSnapshot): DetailBodyParseSnapshot {
  const fr = detailBody.raw.flightRaw?.trim()
  if (!fr) return detailBody
  const flightStructured = parseLottetourFlightInput(fr, detailBody.normalizedRaw)
  return withLottetourFlightStructured(detailBody, flightStructured)
}

export const LOTTETOUR_PRICE_SLOT_SSOT_NOTE =
  '롯데관광 가격(3슬롯): adultPrice=성인, childExtraBedPrice=아동 단가, childNoBedPrice=null, infantPrice=유아. 쿠폰·총액·잔여석·출발일변경·적립·무이자 등은 슬롯에 넣지 않습니다.'

export const LOTTETOUR_FLIGHT_PREVIEW_NOTE =
  '롯데관광 항공: 정형칸 병합 후 flightStructured를 재계산합니다. 출발/도착 블록에서 항공사(첫 줄)·편명·도시·일시를 구조화합니다.'

export async function parseForRegisterLottetour(
  rawText: string,
  originSource?: string,
  options?: ParseOpts
): Promise<RegisterParsed> {
  const osPrev = (originSource ?? '').trim().slice(0, 100)
  console.log(
    `[lottetour] phase=parse-for-register entry fn=parseForRegisterLottetour originSource_preview=${JSON.stringify(osPrev)} rawText_len=${rawText?.length ?? 0}`
  )
  let detailBody = parseDetailBodyStructuredLottetour({
    rawText,
    hotelRaw: options?.pastedBlocks?.hotel ?? null,
    optionalRaw: options?.pastedBlocks?.optionalTour ?? null,
    shoppingRaw: options?.pastedBlocks?.shopping ?? null,
  })
  detailBody = mergeAirlineTransportPaste(detailBody, options?.pastedBlocks?.airlineTransport?.trim())
  const airlinePasteOnly = options?.pastedBlocks?.airlineTransport?.trim()
  if (airlinePasteOnly) {
    detailBody = withLottetourFlightStructured(detailBody, parseLottetourFlightInput(airlinePasteOnly, null))
  } else {
    detailBody = applyLottetourMergedFlightRawToStructured(detailBody)
  }
  const optPaste = options?.pastedBlocks?.optionalTour?.trim() ?? ''
  const shopPaste = options?.pastedBlocks?.shopping?.trim() || null
  detailBody = refreshLottetourDetailBodyPolicy({
    ...detailBody,
    optionalToursStructured: parseLottetourOptionalInput(optPaste),
    shoppingStructured: parseLottetourShoppingInput('', shopPaste),
  })
  logLottetourBasicDetailBody(detailBody, rawText?.length ?? 0)

  let parsed = await parseForRegisterLlmLottetour(rawText, originSource, {
    ...options,
    presetDetailBody: detailBody,
    resolveDirectedFlightLines: resolveDirectedFlightLinesLottetour,
  })
  parsed = finalizeLottetourRegisterParsedPricing(parsed)
  parsed = finalizeLottetourRegisterParsedShopping(parsed)
  parsed = applyLottetourStructuredPreviewFields(parsed)
  parsed = mergeLottetourMasterIdsFromBlob(parsed, rawText)
  parsed = mergeLottetourDetailBodyExtractIntoParsed(parsed, detailBody)

  const originBlobCode = extractLottetourProductCodeFromBlob(rawText)
  if (originBlobCode && !(parsed.originCode ?? '').trim()) {
    parsed = { ...parsed, originCode: originBlobCode }
  }
  logLottetourBasicRegisterFinal(parsed, rawText?.length ?? 0)

  const norm = parsed.detailBodyStructured?.normalizedRaw?.trim() || rawText.trim()
  parsed = applyLottetourBasicInfoMustKnowExtract(parsed, norm)

  const prevNotes = parsed.registerPreviewPolicyNotes ?? []
  const extra: string[] = []
  if (!prevNotes.some((n) => n.includes('롯데관광 가격(3슬롯)'))) extra.push(LOTTETOUR_PRICE_SLOT_SSOT_NOTE)
  if (!prevNotes.some((n) => n.includes('롯데관광 항공:'))) extra.push(LOTTETOUR_FLIGHT_PREVIEW_NOTE)
  if (extra.length) {
    parsed = { ...parsed, registerPreviewPolicyNotes: [...prevNotes, ...extra] }
  }

  parsed = sanitizeLottetourRegisterParsedStrings(parsed)
  return parsed
}

export type { RegisterParsed } from '@/lib/register-llm-schema-lottetour'
