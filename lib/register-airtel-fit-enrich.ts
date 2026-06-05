/**
 * 자유여행(air_hotel_free / productType=airtel) 등록 — preview·confirm 공통.
 * 본문 LLM 이후 Gemini 예시 일정 + 일차 imageKeyword → parsed.schedule (미리보기·확정 UI SSOT).
 */
import { AIR_HOTEL_PRODUCT_TYPE, isAirHotelFitItineraryProduct } from '@/lib/air-hotel-product-ssot'
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
import { mergeScheduleWithSingleAirtelFitKeyword } from '@/lib/fit-itinerary-merge-schedule-keywords'
import type { SyncFitScheduleKeywordsResult } from '@/lib/fit-itinerary-sync-schedule-image-keywords'
import type { FitDayImageKeywordFallbackContext } from '@/lib/fit-itinerary-pick-day-image-keyword'
import type { ProductScheduleJsonRow } from '@/lib/schedule-image-keyword-persist'
import { pickSingleAirtelFitImageKeywordFromDays } from '@/lib/fit-itinerary-pick-day-image-keyword'
import { collectRouteLandmarkKeywordsFromRouteText } from '@/lib/ybtour-schedule-image-keyword'
import { isBareCityOrCountryKeyword } from '@/lib/pexels-place-name-keyword'

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
  /** 자유여행 SSOT — 예시 일정 일차 + 동일 imageKeyword 1개 */
  const { rows, dayKeywords } = mergeScheduleWithSingleAirtelFitKeyword([], fitDays, fallbackCtx)
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

function isWeakAirtelRegisterImageKeyword(kw: string | null | undefined): boolean {
  const t = String(kw ?? '').trim()
  if (!t || t.toLowerCase() === 'travel') return true
  if (/^nha$/i.test(t)) return true
  if (/^nha\s*trang$/i.test(t)) return true
  return isBareCityOrCountryKeyword(t)
}

/** 약한 단일 키워드일 때만 routeText에서 대표 랜드마크 1개로 보완(일차별 분기 금지) */
function applySingleAirtelKeywordRouteTextBoostIfNeeded(
  schedule: RegisterScheduleDay[],
  singleKw: string,
): RegisterScheduleDay[] {
  if (!isWeakAirtelRegisterImageKeyword(singleKw)) {
    return schedule.map((row) => ({ ...row, imageKeyword: singleKw, imageKeyword2: null }))
  }
  for (const row of schedule) {
    const list = collectRouteLandmarkKeywordsFromRouteText(String(row.routeText ?? '').trim())
    for (const kw of list) {
      if (!isWeakAirtelRegisterImageKeyword(kw)) {
        return schedule.map((r) => ({ ...r, imageKeyword: kw, imageKeyword2: null }))
      }
    }
  }
  return schedule.map((row) => ({ ...row, imageKeyword: singleKw, imageKeyword2: null }))
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
      const singleKw =
        Object.values(dayKeywords)[0] ??
        pickSingleAirtelFitImageKeywordFromDays(fitDays, fallbackCtxFromRegisterParsed(parsed))
      schedule = applySingleAirtelKeywordRouteTextBoostIfNeeded(schedule, singleKw)
      if (singleKw) {
        issues.push(
          airtelFitFieldIssue(`예시 일정(저장본) — imageKeyword 1건 반영: ${singleKw}`, 'info'),
        )
      }
      return {
        ...parsed,
        productType: AIR_HOTEL_PRODUCT_TYPE,
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
    return { ...parsed, productType: AIR_HOTEL_PRODUCT_TYPE, extractionFieldIssues: issues }
  }

  try {
    const promptProduct = registerParsedToFitPromptProduct(parsed)
    const prompt = buildAirtelPrompt(promptProduct)
    const geminiResult = await generateFitItineraryGeminiResponse(prompt, logLabel)
    const response = parseFitItineraryGeminiJson(geminiResult.text, logLabel)
    geminiJson = geminiResult.text.trim()
    const fitDays = fitGeminiResponseToKeywordDays(response)
    let { schedule, dayKeywords } = mergeParsedScheduleWithFitDays(parsed, fitDays)
    const singleKw =
      Object.values(dayKeywords)[0] ??
      pickSingleAirtelFitImageKeywordFromDays(fitDays, fallbackCtxFromRegisterParsed(parsed))
    schedule = applySingleAirtelKeywordRouteTextBoostIfNeeded(schedule, singleKw)
    if (singleKw) {
      issues.push(
        airtelFitFieldIssue(`예시 일정 Gemini 생성 완료 — imageKeyword 1건: ${singleKw}`, 'info'),
      )
    } else {
      issues.push(airtelFitFieldIssue('예시 일정은 생성됐으나 imageKeyword를 추출하지 못했습니다.', 'warn'))
    }
    return {
      ...parsed,
      productType: AIR_HOTEL_PRODUCT_TYPE,
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
    return { ...parsed, productType: AIR_HOTEL_PRODUCT_TYPE, extractionFieldIssues: issues }
  }
}

/** confirm 저장 직후 — preview에서 만든 JSON으로 Fit master persist */
export async function persistRegisterAirtelFitAfterConfirm(
  productId: string,
  registerFitItineraryGeminiJson: string | null | undefined,
  productType: string | null | undefined,
  listingKind?: string | null,
): Promise<void> {
  if (!isAirHotelFitItineraryProduct({ productType, listingKind })) return
  const json = registerFitItineraryGeminiJson?.trim()
  if (!json) return
  const result = await persistFitItineraryFromGeminiJson(productId, json)
  if (!result.success && result.reason !== 'already_exists') {
    console.warn(`[register-airtel-fit] persist failed productId=${productId} reason=${result.reason ?? 'unknown'}`)
  }
}

export type { SyncFitScheduleKeywordsResult }
