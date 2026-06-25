/**
 * 하나투어 등록 parseFn — API SSOT + 붙여넣기 보조(혜택·쿠폰 등)만.
 *
 * REGRESSION-FREEZE[hanatour-register-api-parse]: parseForRegisterHanatour → parseHanatourRegisterFromApi — manifest
 * REGRESSION-FREEZE[register-admin-no-pasted-blocks-ssot]: 정형칸 폐기 — detail-collect API SSOT
 * REGRESSION-FREEZE[hanatour-register-samples-live-gate]: reconcileHanatourExtractionFieldIssuesAfterDetailBodyPatch — manifest
 * REGRESSION-FREEZE[hanatour-register-ssot-freeze]: Gemini overlay 없음 — manifest
 */
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser'
import { parseHanatourRegisterFromApi, type HanatourRegisterApiParseOptions } from '@/lib/hanatour-register-api-parse'
import type { RegisterExtractionFieldIssue, RegisterLlmParseOptionsCommon, RegisterParsed } from '@/lib/register-llm-schema-hanatour'
import {
  buildDetailReviewPolicyHanatour,
  filterRegisterExtractionIssuesShoppingGeminiNoise,
} from '@/lib/review-policy-hanatour'

export type ParseForRegisterHanatourOptions = RegisterLlmParseOptionsCommon

export const HANATOUR_PRICE_SLOT_SSOT_NOTE =
  '하나투어 가격표(3슬롯): adultPrice=성인, childExtraBedPrice=아동 단가, childNoBedPrice=미사용(null), infantPrice=유아. 유류·제세·기본상품가 안내·잔여석 등 메타 줄은 슬롯에 넣지 않습니다.'

export const HANATOUR_FLIGHT_PREVIEW_NOTE =
  '하나투어 항공: originUrl detail-collect(pkgAirSeqList) SSOT. 본문 flightRaw는 보조이며 API 수집이 구조화 필드를 덮어쓴다.'

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

/** pkgAirSeqList·detail-collect 패치 후 sectionReview ↔ extractionFieldIssues 항공 축 재동기화 */
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

export async function parseForRegisterHanatour(
  rawText: string,
  originSource?: string,
  options?: ParseForRegisterHanatourOptions,
): Promise<RegisterParsed> {
  return parseHanatourRegisterFromApi(rawText, originSource, options)
}
