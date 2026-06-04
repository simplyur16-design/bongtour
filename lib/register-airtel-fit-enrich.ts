/**
 * 자유여행(air_hotel_free / productType=airtel) 등록 — preview·confirm 공통.
 * 본문 LLM 이후 Gemini 예시 일정 + 일차 imageKeyword → parsed.schedule (미리보기·확정 UI SSOT).
 */
import type { RegisterExtractionFieldIssue } from '@/lib/register-llm-schema-ybtour'
import type { RegisterParsed, RegisterScheduleDay } from '@/lib/register-llm-schema-ybtour'
import { isRegisterAirtelListing } from '@/lib/register-admin-airtel-listing'
import {
  fitGeminiResponseToKeywordDays,
  parseFitItineraryGeminiJson,
} from '@/lib/fit-itinerary-gemini-parse'
import {
  buildAirtelPrompt,
  generateFitItineraryGeminiResponse,
  persistFitItineraryFromGeminiJson,
  registerParsedToFitPromptProduct,
} from '@/lib/fit-itinerary-generate-for-product'
import { mergeScheduleWithFitKeywords } from '@/lib/fit-itinerary-merge-schedule-keywords'
import type { SyncFitScheduleKeywordsResult } from '@/lib/fit-itinerary-sync-schedule-image-keywords'
import type { FitDayImageKeywordFallbackContext } from '@/lib/fit-itinerary-pick-day-image-keyword'
import type { ProductScheduleJsonRow } from '@/lib/schedule-image-keyword-persist'
import { areFitDayImageKeywordsUniform } from '@/lib/fit-itinerary-pick-day-image-keyword'
import { applyAirtelRouteTextImageKeywordsToSchedule } from '@/lib/register-airtel-route-image-keyword'

export { buildAirtelRegisterScheduleRowsFromFitParsed } from '@/lib/register-airtel-fit-preview-ui'

export type EnrichRegisterAirtelFitOpts = {
  travelScope: string
  logLabel?: string
  /** true면 Gemini 재호출 없이 registerFitItineraryGeminiJson만 사용 */
  reuseStoredGeminiJson?: boolean
}

function registerRowsToScheduleJsonRows(rows: RegisterScheduleDay[]): ProductScheduleJsonRow[] {
  return rows.map((r) => ({
    day: r.day,
    title: r.title ?? null,
    description: r.description ?? null,
    routeText: r.routeText ?? null,
    imageKeyword: r.imageKeyword ?? null,
    imageKeyword2: r.imageKeyword2 ?? null,
  }))
}

function scheduleJsonRowsToRegisterRows(rows: ProductScheduleJsonRow[]): RegisterScheduleDay[] {
  return rows.map((r) => ({
    day: Math.floor(Number(r.day)),
    title: String(r.title ?? '').trim() || `Day ${r.day}`,
    description: String(r.description ?? '').trim(),
    routeText: typeof r.routeText === 'string' ? r.routeText : null,
    imageKeyword: String(r.imageKeyword ?? '').trim(),
    imageKeyword2:
      r.imageKeyword2 != null && String(r.imageKeyword2).trim()
        ? String(r.imageKeyword2).trim()
        : null,
  }))
}

function fallbackCtxFromRegisterParsed(parsed: RegisterParsed): FitDayImageKeywordFallbackContext {
  const cityNameKo =
    parsed.primaryDestination?.trim() || parsed.destination?.trim() || ''
  return {
    cityNameKo,
    cityKey: '',
    productTitle: parsed.title ?? '',
    primaryDestination: parsed.primaryDestination,
    destination: parsed.destination,
  }
}

function mergeParsedScheduleWithFitDays(
  parsed: RegisterParsed,
  fitDays: ReturnType<typeof fitGeminiResponseToKeywordDays>,
): { schedule: RegisterScheduleDay[]; dayKeywords: Record<number, string> } {
  const existing = registerRowsToScheduleJsonRows(parsed.schedule ?? [])
  const existingByDay = new Map(existing.map((r) => [Math.floor(Number(r.day)), r]))
  const fallbackCtx = fallbackCtxFromRegisterParsed(parsed)
  /** 자유여행 SSOT — 예시 일정 일차만; LLM 일정의 통일 imageKeyword 잔존 방지 */
  const { rows, dayKeywords } = mergeScheduleWithFitKeywords([], fitDays, fallbackCtx)
  const merged = rows.map((row) => {
    const day = Math.floor(Number(row.day))
    const prev = existingByDay.get(day)
    if (!prev) return row
    return {
      ...prev,
      day: row.day,
      title: row.title ?? prev.title,
      description: row.description ?? prev.description,
      imageKeyword: row.imageKeyword,
      imageKeyword2: row.imageKeyword2 ?? prev.imageKeyword2,
    }
  })
  return { schedule: scheduleJsonRowsToRegisterRows(merged), dayKeywords }
}

function applyRouteTextFallbackIfFitKeywordsUniform(
  schedule: RegisterScheduleDay[],
  dayKeywords: Record<number, string>,
  issues: RegisterExtractionFieldIssue[],
): RegisterScheduleDay[] {
  if (!areFitDayImageKeywordsUniform(dayKeywords)) return schedule
  issues.push(
    airtelFitFieldIssue(
      '예시 일정 활동에서 일차별 imageKeyword가 동일합니다. activity location 괄호 영문 지명(일차마다 다른 랜드마크)을 확인하세요. routeText 보조 적용.',
      'warn',
    ),
  )
  return applyAirtelRouteTextImageKeywordsToSchedule(schedule)
}

function airtelFitFieldIssue(reason: string, severity: 'info' | 'warn' = 'warn'): RegisterExtractionFieldIssue {
  return {
    field: 'registerFitItinerary',
    reason,
    source: 'llm',
    severity,
  }
}

/** preview·confirm — 예시 일정 Gemini + schedule imageKeyword (공급사 공통) */
export async function enrichRegisterParsedWithAirtelFit(
  parsed: RegisterParsed,
  opts: EnrichRegisterAirtelFitOpts,
): Promise<RegisterParsed> {
  if (!isRegisterAirtelListing(opts.travelScope, parsed.productType)) {
    return parsed
  }

  const logLabel = opts.logLabel ?? 'register-airtel-fit'
  const issues: RegisterExtractionFieldIssue[] = [...(parsed.extractionFieldIssues ?? [])]
  let geminiJson = parsed.registerFitItineraryGeminiJson?.trim() ?? ''

  if (opts.reuseStoredGeminiJson && geminiJson) {
    try {
      const response = parseFitItineraryGeminiJson(geminiJson, logLabel)
      const fitDays = fitGeminiResponseToKeywordDays(response)
      let { schedule, dayKeywords } = mergeParsedScheduleWithFitDays(parsed, fitDays)
      schedule = applyRouteTextFallbackIfFitKeywordsUniform(schedule, dayKeywords, issues)
      if (Object.keys(dayKeywords).length > 0) {
        issues.push(
          airtelFitFieldIssue(
            `예시 일정(저장본)에서 일차 imageKeyword ${Object.keys(dayKeywords).length}건 반영`,
            'info',
          ),
        )
      }
      return {
        ...parsed,
        productType: 'airtel',
        schedule,
        registerFitItineraryGeminiJson: geminiJson,
        extractionFieldIssues: issues,
      }
    } catch (e) {
      console.warn(`[${logLabel}] reuse stored fit json failed`, e)
      issues.push(
        airtelFitFieldIssue('저장된 예시 일정 JSON이 손상되어 Gemini를 다시 호출합니다.', 'warn'),
      )
      geminiJson = ''
    }
  }

  if (process.env.SKIP_REGISTER_AIRTEL_FIT_GEMINI === '1') {
    issues.push(airtelFitFieldIssue('SKIP_REGISTER_AIRTEL_FIT_GEMINI=1 — 예시 일정 Gemini 생략', 'info'))
    return { ...parsed, productType: 'airtel', extractionFieldIssues: issues }
  }

  try {
    const promptProduct = registerParsedToFitPromptProduct(parsed)
    const prompt = buildAirtelPrompt(promptProduct)
    const geminiResult = await generateFitItineraryGeminiResponse(prompt, logLabel)
    const response = parseFitItineraryGeminiJson(geminiResult.text, logLabel)
    geminiJson = geminiResult.text.trim()
    const fitDays = fitGeminiResponseToKeywordDays(response)
    let { schedule, dayKeywords } = mergeParsedScheduleWithFitDays(parsed, fitDays)
    schedule = applyRouteTextFallbackIfFitKeywordsUniform(schedule, dayKeywords, issues)
    if (Object.keys(dayKeywords).length > 0) {
      const distinct = new Set(Object.values(dayKeywords).map((k) => k.toLowerCase())).size
      issues.push(
        airtelFitFieldIssue(
          `예시 일정 Gemini 생성 완료 — 일차 imageKeyword ${Object.keys(dayKeywords).length}건 (고유 ${distinct}종)`,
          'info',
        ),
      )
    } else {
      issues.push(airtelFitFieldIssue('예시 일정은 생성됐으나 imageKeyword를 추출하지 못했습니다.', 'warn'))
    }
    return {
      ...parsed,
      productType: 'airtel',
      schedule,
      registerFitItineraryGeminiJson: geminiJson,
      extractionFieldIssues: issues,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[${logLabel}] gemini_failed`, e)
    issues.push(
      airtelFitFieldIssue(`예시 일정 Gemini 실패: ${msg.slice(0, 240)}. 확정 후 backfill cron으로 재시도됩니다.`),
    )
    return { ...parsed, productType: 'airtel', extractionFieldIssues: issues }
  }
}

/** confirm 저장 직후 — preview에서 만든 JSON으로 Fit master persist */
export async function persistRegisterAirtelFitAfterConfirm(
  productId: string,
  registerFitItineraryGeminiJson: string | null | undefined,
  productType: string | null | undefined,
): Promise<void> {
  if (productType !== 'airtel') return
  const json = registerFitItineraryGeminiJson?.trim()
  if (!json) return
  const result = await persistFitItineraryFromGeminiJson(productId, json)
  if (!result.success && result.reason !== 'already_exists') {
    console.warn(`[register-airtel-fit] persist failed productId=${productId} reason=${result.reason ?? 'unknown'}`)
  }
}

export type { SyncFitScheduleKeywordsResult }
