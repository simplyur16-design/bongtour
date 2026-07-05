/**
 * 자유여행 등록 미리보기 — 일차 imageKeyword UI 행 (클라이언트·서버 공용, node:crypto 없음).
 * REGRESSION-FREEZE[airtel-fit-per-day-keywords]: Fit·일차별 키워드 SSOT — manifest
 */
import type { RegisterParsed, RegisterScheduleDay } from '@/lib/register-llm-schema-ybtour'
import { buildAirtelRegisterScheduleRowsFromFitParsed } from '@/lib/register-airtel-fit-preview-ui'
import {
  applyAirtelRouteTextImageKeywordsToSchedule,
  boostWeakAirtelScheduleImageKeywordsFromRouteText,
} from '@/lib/register-airtel-route-image-keyword'
import {
  areScheduleImageKeywordsDistinct,
  finalizeRegisterScheduleImageKeywords,
} from '@/lib/schedule-image-keyword-persist'

export function scheduleRowsHaveUniformWeakAirtelKeyword(
  rows: Array<{ imageKeyword?: string | null }>,
): boolean {
  const kws = rows
    .map((r) => String(r.imageKeyword ?? '').trim().toLowerCase())
    .filter((k) => k.length > 0)
  if (kws.length < 2) return false
  return !areScheduleImageKeywordsDistinct(rows)
}

/** 본문 LLM parsed.schedule + routeText 보조 (Fit JSON 없을 때만) */
export function buildAirtelRegisterScheduleRowsFromParsed(
  parsed: RegisterParsed | null | undefined,
): RegisterScheduleDay[] | null {
  if (!parsed) return null
  const valid = (parsed.schedule ?? []).filter((row) => {
    const day = Number(row.day)
    return Number.isFinite(day) && day >= 1
  })
  if (!valid.length) return null
  const rows: RegisterScheduleDay[] = valid.map((row) => ({
    day: Number(row.day),
    title: String(row.title ?? '').trim() || `Day ${row.day}`,
    description: String(row.description ?? '').trim(),
    routeText: String((row as { routeText?: string | null }).routeText ?? '').trim() || null,
    imageKeyword: String(row.imageKeyword ?? '').trim(),
    imageKeyword2:
      row.imageKeyword2 != null && String(row.imageKeyword2).trim()
        ? String(row.imageKeyword2).trim()
        : null,
  }))
  return applyAirtelRouteTextImageKeywordsToSchedule(rows)
}

export function finalizeAirtelRegisterPexelsUiRows(
  rows: RegisterScheduleDay[],
  productDestination: string | null | undefined,
  opts?: { fromFitJson?: boolean },
): RegisterScheduleDay[] {
  const routed = opts?.fromFitJson
    ? boostWeakAirtelScheduleImageKeywordsFromRouteText(rows)
    : applyAirtelRouteTextImageKeywordsToSchedule(rows)
  return finalizeRegisterScheduleImageKeywords(routed, {
    productDestination: productDestination ?? null,
  }).map((row) => ({
    day: row.day,
    title: String(row.title ?? '').trim() || `Day ${row.day}`,
    description: String(row.description ?? '').trim(),
    routeText: row.routeText ?? null,
    imageKeyword: String(row.imageKeyword ?? '').trim(),
    imageKeyword2:
      row.imageKeyword2 != null && String(row.imageKeyword2).trim()
        ? String(row.imageKeyword2).trim()
        : null,
  }))
}

/**
 * SSOT: registerFitItineraryGeminiJson(Fit 예시일정) → title·description·일차별 imageKeyword.
 * Fit JSON이 있으면 Gemini 2문장 요약·시적 제목을 유지하고, 키워드만 약할 때 routeText로 일차별 보완.
 */
export function buildAirtelRegisterPexelsUiScheduleRows(
  parsed: RegisterParsed | null | undefined,
  productDestination: string | null | undefined,
): RegisterScheduleDay[] | null {
  const fromFit = buildAirtelRegisterScheduleRowsFromFitParsed(parsed)
  const fromParsed = buildAirtelRegisterScheduleRowsFromParsed(parsed)

  // Fit 일차별 랜드마크 SSOT — parsed routeText-only 경로보다 우선 (uniform Nha 등 제외)
  if (fromFit?.length && (areScheduleImageKeywordsDistinct(fromFit) || parsed?.registerFitItineraryGeminiJson?.trim())) {
    return finalizeAirtelRegisterPexelsUiRows(fromFit, productDestination, { fromFitJson: true })
  }

  if (fromParsed?.length) {
    return finalizeAirtelRegisterPexelsUiRows(fromParsed, productDestination, { fromFitJson: false })
  }

  if (fromFit?.length) {
    return finalizeAirtelRegisterPexelsUiRows(fromFit, productDestination, { fromFitJson: true })
  }

  return null
}
