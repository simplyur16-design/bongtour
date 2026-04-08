import { geminiTimeoutOpts } from '@/lib/gemini-client'
import type { DetailBodyParseSnapshot, DetailSectionType } from '@/lib/detail-body-parser'
import { DETAIL_BODY_GEMINI_PROMPTS } from '@/lib/detail-body-gemini-prompts'
import { parseLlmJsonObject } from '@/lib/llm-json-extract'
import { brandKeyExpectsFlightNumber } from '@/lib/brand-key-register'
import { isFlightAxisEngaged } from '@/lib/review-axis-guards'

export type RepairMode = 'always' | 'conditional' | 'skip'

export async function runDetailSectionGeminiRepair(
  model: {
    generateContent: (
      req: {
        contents: Array<{ role: string; parts: Array<{ text: string }> }>
        generationConfig?: Record<string, unknown>
      },
      opts?: Record<string, unknown>
    ) => Promise<{ response: { text: () => string } }>
  },
  sectionType: DetailSectionType,
  sectionText: string
): Promise<Record<string, unknown> | null> {
  if (!sectionText.trim()) return null
  const templateMap: Partial<Record<DetailSectionType, keyof typeof DETAIL_BODY_GEMINI_PROMPTS>> = {
    hotel_section: 'normalize_hotel_table',
    optional_tour_section: 'normalize_optional_tours_table',
    shopping_section: 'normalize_shopping_table',
    flight_section: 'normalize_flight_block',
    included_excluded_section: 'summarize_included_excluded',
  }
  const key = templateMap[sectionType]
  if (!key) return null
  const prompt = DETAIL_BODY_GEMINI_PROMPTS[key].replace('{{section_text}}', sectionText.slice(0, 12000))
  try {
    const result = await model.generateContent(
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 4096, ...( { responseMimeType: 'application/json' } as { responseMimeType?: string }) },
      },
      geminiTimeoutOpts()
    )
    return parseLlmJsonObject<Record<string, unknown>>(result.response.text())
  } catch {
    return null
  }
}

export function decideSectionRepairPolicy(detailBody: DetailBodyParseSnapshot): Array<{ section: DetailSectionType; mode: RepairMode; reason: string }> {
  const out: Array<{ section: DetailSectionType; mode: RepairMode; reason: string }> = []
  const sectionHas = (type: DetailSectionType) => detailBody.sections.some((s) => s.type === type && s.text.trim().length > 0)
  const hasRequired = detailBody.review.required.length > 0
  const flightEngaged = isFlightAxisEngaged({
    flightStructured: detailBody.flightStructured,
    sections: detailBody.sections,
    optionalPasteRaw: detailBody.raw?.optionalToursPasteRaw,
    shoppingPasteRaw: detailBody.raw?.shoppingPasteRaw,
  })
  const expectFlightNo = brandKeyExpectsFlightNumber(detailBody.brandKey)
  const flightNoMissingForRepair =
    expectFlightNo &&
    (!detailBody.flightStructured.outbound.flightNo || !detailBody.flightStructured.inbound.flightNo)
  out.push({
    section: 'flight_section',
    mode: !flightEngaged
      ? 'skip'
      : detailBody.flightStructured.reviewNeeded
        ? 'always'
        : (detailBody.qualityScores?.flightQualityScore ?? 100) < 60 || flightNoMissingForRepair
          ? 'conditional'
          : 'skip',
    reason: !flightEngaged
      ? '항공 축 미검출(본문에 항공 후보 없음)'
      : detailBody.flightStructured.reviewNeeded
        ? '가는편/오는편 분리 실패'
        : flightNoMissingForRepair
          ? '편명/핵심 필드 누락'
          : '충분',
  })
  out.push({
    section: 'hotel_section',
    mode:
      detailBody.hotelStructured.reviewNeeded || (sectionHas('hotel_section') && detailBody.hotelStructured.rows.length === 0)
        ? 'always'
        : (detailBody.qualityScores?.hotelQualityScore ?? 100) < 55 ||
            (detailBody.hotelStructured.rows.length > 0 && detailBody.hotelStructured.rows.every((r) => !r.hotelNameText.trim()))
          ? 'conditional'
          : 'skip',
    reason:
      detailBody.hotelStructured.reviewNeeded || (sectionHas('hotel_section') && detailBody.hotelStructured.rows.length === 0)
        ? '호텔 섹션 존재 + row 0'
        : detailBody.hotelStructured.rows.length > 0 && detailBody.hotelStructured.rows.every((r) => !r.hotelNameText.trim())
          ? 'hotelNameText 대부분 비어 있음'
          : '충분',
  })
  out.push({
    section: 'optional_tour_section',
    mode:
      sectionHas('optional_tour_section') && detailBody.optionalToursStructured.rows.length === 0
        ? 'always'
        : detailBody.optionalToursStructured.reviewNeeded
          ? 'always'
          : (detailBody.qualityScores?.optionalTourQualityScore ?? 100) < 55
            ? 'conditional'
            : 'skip',
    reason:
      sectionHas('optional_tour_section') && detailBody.optionalToursStructured.rows.length === 0
        ? '선택관광 섹션 존재 + row 0'
        : detailBody.optionalToursStructured.reviewNeeded
          ? '데이터행/설명문 분리 실패'
          : '충분',
  })
  out.push({
    section: 'shopping_section',
    mode:
      sectionHas('shopping_section') && detailBody.shoppingStructured.rows.length === 0 && !!detailBody.shoppingStructured.shoppingCountText
        ? 'always'
        : sectionHas('shopping_section') && detailBody.shoppingStructured.rows.length === 0
          ? 'always'
          : detailBody.shoppingStructured.reviewNeeded
            ? 'always'
            : (detailBody.qualityScores?.shoppingQualityScore ?? 100) < 55
              ? 'conditional'
              : 'skip',
    reason:
      sectionHas('shopping_section') && detailBody.shoppingStructured.rows.length === 0 && !!detailBody.shoppingStructured.shoppingCountText
        ? '쇼핑횟수는 있으나 row 0'
        : detailBody.shoppingStructured.reviewNeeded
          ? '쇼핑 row 핵심 열 복원 실패'
          : '충분',
  })
  out.push({
    section: 'included_excluded_section',
    mode:
      detailBody.includedExcludedStructured.reviewNeeded ||
      (sectionHas('included_excluded_section') &&
        detailBody.includedExcludedStructured.includedItems.length === 0 &&
        detailBody.includedExcludedStructured.excludedItems.length === 0 &&
        !!detailBody.includedExcludedStructured.noteText.trim()) ||
      (hasRequired && sectionHas('included_excluded_section'))
        ? 'conditional'
        : 'skip',
    reason:
      detailBody.includedExcludedStructured.reviewNeeded || (hasRequired && sectionHas('included_excluded_section'))
        ? '포함/불포함 분리 애매'
        : '충분',
  })
  return out
}
