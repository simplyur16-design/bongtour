/**
 * 하나투어 전용 등록 파싱 orchestration.
 *
 * **책임 분리:** `parseDetailBodyStructuredHanatour`는 본문 슬라이스·호텔·포함불포함·예약 한 줄 추출 등만 한다.
 * 항공·옵션·쇼핑 **구조화**는 `register-input-parse-hanatour`로, **정형 입력란**만 기준으로 한다.
 *
 * [P2 항공 허브] 항공칸 있으면 입력란만 flightStructured · 없으면 본문 flightRaw → `parseHanatourFlightInput`.
 * LLM에는 `resolveDirectedFlightLinesHanatour` 필수 주입. modetour `register-modetour-flight`에 해당하는 별도 파일 없음 — 이 모듈이 병합 허브.
 *
 * @see docs/body-parser-hanatour-ssot.md · `docs/ops/hanatour-parse-contract.md`
 *
 * 상위 입력 규약: `docs/admin-register-supplier-precise-spec.md` §3. 일정 표현: `docs/register_schedule_expression_ssot.md`.
 */
import { parseDetailBodyStructuredHanatour } from '@/lib/detail-body-parser-hanatour'
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser'
import { parseForRegisterLlmHanatour } from '@/lib/register-from-llm-hanatour'
import type { RegisterExtractionFieldIssue, RegisterParsed } from '@/lib/register-llm-schema-hanatour'
import { resolveDirectedFlightLinesHanatour } from '@/lib/register-flight-hanatour'
import {
  parseHanatourFlightInput,
  parseHanatourOptionalInput,
  parseHanatourShoppingInput,
} from '@/lib/register-input-parse-hanatour'
import {
  buildDetailReviewPolicyHanatour,
  filterRegisterExtractionIssuesShoppingGeminiNoise,
} from '@/lib/review-policy-hanatour'
import { applyHanatourBasicInfoBodyExtract } from '@/lib/hanatour-basic-info-body-extract'
import { sanitizeHanatourRegisterParsedDepartureFields } from '@/lib/hanatour-departure-flight-display'
import { finalizeHanatourRegisterParsedPricing } from '@/lib/register-hanatour-price'
import { finalizeHanatourRegisterParsedShopping } from '@/lib/register-hanatour-shopping'
import { applyHanatourOriginCodeFromPaste } from '@/lib/hanatour-origin-code-from-paste'

type ParseOpts = NonNullable<Parameters<typeof parseForRegisterLlmHanatour>[2]>

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

/** API·정형칸 병합 후 flightStructured가 바뀌면 review·sectionReview를 재계산한다. */
/** REGRESSION-FREEZE[hanatour-register-samples-live-gate]: pkgAirSeqList 후 review 재계산 — manifest */
function isHanatourFlightExtractionIssue(issue: RegisterExtractionFieldIssue): boolean {
  if (issue.field === 'flight_info') return true
  return /항공|편명|구조화|출발\/도착/.test(issue.reason)
}

function appendHanatourSectionReviewExtractionIssues(
  out: RegisterExtractionFieldIssue[],
  field: string,
  block: { required?: string[]; warning?: string[]; info?: string[] } | undefined,
): void {
  if (!block) return
  for (const reason of block.required ?? []) {
    out.push({
      field,
      reason: `[REVIEW REQUIRED] ${reason}`,
      source: 'auto',
      severity: 'warn',
    })
  }
  for (const reason of block.warning ?? []) {
    out.push({ field, reason, source: 'auto', severity: 'warn' })
  }
  for (const reason of block.info ?? []) {
    out.push({ field, reason, source: 'auto', severity: 'info' })
  }
}

/** pkgAirSeqList·정형칸 패치 후 sectionReview ↔ extractionFieldIssues 항공 축 재동기화 */
/** REGRESSION-FREEZE[hanatour-register-samples-live-gate]: reconcileHanatourExtractionFieldIssuesAfterDetailBodyPatch — manifest */
export function reconcileHanatourExtractionFieldIssuesAfterDetailBodyPatch(
  parsed: RegisterParsed,
): RegisterParsed {
  const db = parsed.detailBodyStructured
  if (!db) return parsed
  const kept = (parsed.extractionFieldIssues ?? []).filter((i) => !isHanatourFlightExtractionIssue(i))
  const flightIssues: RegisterExtractionFieldIssue[] = []
  appendHanatourSectionReviewExtractionIssues(flightIssues, 'flight_info', db.sectionReview?.flight_section)
  return {
    ...parsed,
    extractionFieldIssues: filterRegisterExtractionIssuesShoppingGeminiNoise([...kept, ...flightIssues]),
  }
}

export function hanatourOptionalTourNamesFromParsed(parsed: RegisterParsed): string[] {
  const raw = parsed.optionalToursStructured
  if (!raw?.trim()) return []
  try {
    const arr = JSON.parse(raw) as Array<{ name?: string; title?: string; chcStsngNm?: string }>
    if (!Array.isArray(arr)) return []
    return arr
      .map((r) => String(r.name ?? r.title ?? r.chcStsngNm ?? '').trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

export function refreshHanatourDetailBodyPolicy(detailBody: DetailBodyParseSnapshot): DetailBodyParseSnapshot {
  const policy = buildDetailReviewPolicyHanatour({
    sections: detailBody.sections,
    flightStructured: detailBody.flightStructured,
    hotelStructured: detailBody.hotelStructured,
    optionalToursStructured: detailBody.optionalToursStructured,
    shoppingStructured: detailBody.shoppingStructured,
    includedExcludedStructured: detailBody.includedExcludedStructured,
    optionalPasteRaw: detailBody.raw?.optionalToursPasteRaw ?? null,
    shoppingPasteRaw: detailBody.raw?.shoppingPasteRaw ?? null,
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
  '하나투어 항공: originUrl detail-collect(pkgAirSeqList) SSOT. 본문 flightRaw는 보조이며 API 수집이 구조화 필드를 덮어쓴다.'

export async function parseForRegisterHanatour(
  rawText: string,
  originSource?: string,
  options?: ParseOpts
): Promise<RegisterParsed> {
  // REGRESSION-FREEZE[register-admin-no-pasted-blocks-ssot]: 항공·옵션·쇼핑·호텔 정형칸 폐기 — detail-collect API SSOT
  let detailBody = parseDetailBodyStructuredHanatour({
    rawText,
    hotelRaw: null,
    optionalRaw: null,
    shoppingRaw: null,
  })
  detailBody = applyHanatourMergedFlightRawToStructured(detailBody)
  detailBody = refreshHanatourDetailBodyPolicy({
    ...detailBody,
    optionalToursStructured: parseHanatourOptionalInput(''),
    shoppingStructured: parseHanatourShoppingInput('', null),
  })
  let parsed = await parseForRegisterLlmHanatour(rawText, originSource, {
    ...options,
    presetDetailBody: detailBody,
    resolveDirectedFlightLines: resolveDirectedFlightLinesHanatour,
    /** 정형 파서(detailBody)가 표·항공을 이미 구조화 — 섹션별 repair generateContent 연속 호출 생략 */
    skipDetailSectionGeminiRepairs: true,
    /** confirm 이중 LLM(일정 선추출+메인) 축소 — 기본 일정은 메인 JSON 한 번에서만 */
    skipScheduleExtractLlm: options?.skipScheduleExtractLlm ?? false,
  })
  parsed = applyHanatourBasicInfoBodyExtract(parsed, detailBody.normalizedRaw ?? '')
  parsed = sanitizeHanatourRegisterParsedDepartureFields(parsed, detailBody.normalizedRaw ?? '')
  parsed = finalizeHanatourRegisterParsedPricing(parsed)
  parsed = finalizeHanatourRegisterParsedShopping(parsed)

  parsed = applyHanatourOriginCodeFromPaste(parsed, rawText)

  const prevNotes = parsed.registerPreviewPolicyNotes ?? []
  const extra: string[] = []
  if (!prevNotes.some((n) => n.includes('하나투어 가격표(3슬롯)'))) extra.push(HANATOUR_PRICE_SLOT_SSOT_NOTE)
  if (!prevNotes.some((n) => n.includes('하나투어 항공:'))) extra.push(HANATOUR_FLIGHT_PREVIEW_NOTE)
  if (extra.length) {
    parsed = { ...parsed, registerPreviewPolicyNotes: [...prevNotes, ...extra] }
  }

  return parsed
}

