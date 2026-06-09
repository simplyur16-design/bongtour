/**
 * 자유여행 등록 미리보기 — 일차 imageKeyword UI 행 (클라이언트·서버 공용, node:crypto 없음).
 * REGRESSION-FREEZE[airtel-fit-per-day-keywords]: Fit·일차별 키워드 SSOT — manifest
 */
import type { RegisterParsed, RegisterScheduleDay } from '@/lib/register-llm-schema-ybtour'
import { buildAirtelRegisterScheduleRowsFromFitParsed } from '@/lib/register-airtel-fit-preview-ui'
import { applyAirtelRouteTextImageKeywordsToSchedule } from '@/lib/register-airtel-route-image-keyword'
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
  return new Set(kws).size === 1
}

/** 본문 LLM parsed.schedule + routeText 보조 (API enrich 결과 SSOT) */
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
): RegisterScheduleDay[] {
  const routed = applyAirtelRouteTextImageKeywordsToSchedule(rows)
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
 * SSOT 우선순위: (1) Fit JSON 일차별 랜드마크 (2) parsed.schedule 일차별 구분 (3) routeText 보조.
 * routeText 존재만으로 Fit·일차별 키워드를 건너뛰지 않는다(단일 도시·Nha 회귀 방지).
 */
export function buildAirtelRegisterPexelsUiScheduleRows(
  parsed: RegisterParsed | null | undefined,
  productDestination: string | null | undefined,
): RegisterScheduleDay[] | null {
  const fromFit = buildAirtelRegisterScheduleRowsFromFitParsed(parsed)
  const fromParsed = buildAirtelRegisterScheduleRowsFromParsed(parsed)

  const candidates: RegisterScheduleDay[][] = []
  if (fromFit?.length) candidates.push(fromFit)
  if (fromParsed?.length) candidates.push(fromParsed)

  let chosen: RegisterScheduleDay[] | null = null
  for (const rows of candidates) {
    if (areScheduleImageKeywordsDistinct(rows)) {
      chosen = rows
      break
    }
  }
  if (!chosen) {
    chosen = fromFit?.length ? fromFit : fromParsed?.length ? fromParsed : null
  }
  if (!chosen?.length) return null

  return finalizeAirtelRegisterPexelsUiRows(chosen, productDestination)
}
