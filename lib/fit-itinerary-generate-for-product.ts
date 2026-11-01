/**
 * 단일 Product에 FitItineraryMaster + Day + Activity 생성 (Gemini v3 JSON).
 * 자유여행(air-hotel / 레거시 airtel) 전용 — 등록 hook·backfill cron SSOT.
 * REGRESSION-FREEZE[fit-itinerary-gemini-route-keyword]: 예시 일정에서 동선·attraction 키워드 — manifest
 */
import { randomBytes } from 'node:crypto'
import { isAirHotelFitItineraryProduct } from '@/lib/air-hotel-product-ssot'
import { prisma } from '@/lib/prisma'
import {
  GEMINI_MODEL,
  geminiTimeoutOpts,
  getGenAI,
  getModelName,
} from '@/lib/gemini-client'
import { syncScheduleImageKeywordsFromFitItinerary } from '@/lib/fit-itinerary-sync-schedule-image-keywords'
import {
  fitGeminiResponseToKeywordDays,
  parseFitItineraryGeminiJson,
  type FitItineraryGeminiResponse,
} from '@/lib/fit-itinerary-gemini-parse'
import {
  PLACE_NAME_SPELLING_PROMPT_RULE,
  normalizePlaceNameSpellingText,
} from '@/lib/place-name-spelling'
import type { FitItineraryDayForKeyword } from '@/lib/fit-itinerary-pick-day-image-keyword'
import { logLlmJsonRawDebug } from '@/lib/llm-json-extract'
import { BONGTOUR_FREE_DAY_VOICE_BLOCK } from '@/lib/bongtour-free-day-voice-block'
import { resolveFitDayCityKey } from '@/lib/fit-itinerary-day-city-key'
import { buildProductScheduleJsonForDb } from '@/lib/schedule-image-keyword-persist'
import type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'
import { resolveFitTotalDays } from '@/lib/fit-itinerary-total-days'
import { validateFitItineraryGeminiDays } from '@/lib/fit-itinerary-validate-days'
import { recordItineraryGenerationStatus } from '@/lib/fit-itinerary-generation-status'

/** 다일정 Fit JSON — season(4096)과 달리 5~6일·activities 다수 시 8k+ chars. 기본 16384 */
const FIT_ITINERARY_MAX_OUTPUT_TOKENS = Math.max(
  4096,
  Number(process.env.FIT_ITINERARY_MAX_OUTPUT_TOKENS) || 16384,
)
const FIT_ITINERARY_MAX_OUTPUT_TOKENS_RETRY = Math.max(
  FIT_ITINERARY_MAX_OUTPUT_TOKENS,
  Number(process.env.FIT_ITINERARY_MAX_OUTPUT_TOKENS_RETRY) || 32768,
)

const countryCodeMap: Record<string, string> = {
  taiwan: 'TW',
  japan: 'JP',
  china: 'CN',
  france: 'FR',
  greece: 'GR',
  hong_kong: 'HK',
  'hong-kong': 'HK',
  indonesia: 'ID',
  malaysia: 'MY',
  saipan: 'MP',
  singapore: 'SG',
  vietnam: 'VN',
  australia: 'AU',
  macau: 'MO',
}

export type GenerateFitItineraryResult = {
  success: boolean
  masterId?: string
  reason?:
    | 'already_exists'
    | 'not_airtel'
    | 'gemini_failed'
    | 'db_failed'
    | 'days_unknown'
    | 'validation_failed'
  error?: unknown
  /** 사람이 읽는 실패 내용(키 값 없음) */
  detail?: string
}

type PromptProduct = {
  title: string
  cityNameKo: string
  cityKey: string
  countryCode: string
  duration: string
  totalDays: number
  airline: string | null
  hotelSummaryText: string | null
  airtelHotelInfoJson: string | null
  schedule: string | null
}

function cuid(): string {
  return 'c' + Date.now().toString(36) + randomBytes(8).toString('hex')
}

function fitItineraryModelName(): string {
  return (process.env.GEMINI_MODEL?.trim() || GEMINI_MODEL || 'gemini-3-flash-preview')
}

export function buildAirtelPrompt(p: PromptProduct): string {
  const activityRule = p.totalDays >= 5 ? '정확히 3개(JSON 잘림 방지 — 4개 이상 금지)' : '3~4개'
  const hotelLine = p.hotelSummaryText ?? p.airtelHotelInfoJson ?? '에어텔 포함(호텔 주소 정보 없음)'
  // REGRESSION-FREEZE[fit-gemini-recommended-itinerary-1101]: 자유여행은 공급사 일정표를 읽지 않고 제미나이가 전 일차 추천일정을 만든다 — manifest
  return `당신은 봉투어 자유여행 상품의 '추천 예시 일정'을 짜는 봉실장(봉투어 실장)입니다. 이 일정은 고객이 참고하는 예시이고, 실제 예약 조건은 아닙니다.

[상품 정보 — 이 안의 사실만 씁니다]
- 제목(참고용 — 상품 제목 문구를 일정 제목·요약에 그대로 옮겨 쓰지 않습니다): ${p.title}
- 도시: ${p.cityNameKo} (cityKey: ${p.cityKey}, 국가: ${p.countryCode})
- 일정: ${p.duration} (총 ${p.totalDays}일)
- 항공사: ${p.airline ?? '미지정'}
- 호텔: ${hotelLine}
- 공급사 일정표: 쓰지 않습니다(자유여행은 항공·호텔만 정해진 상품). 아래 규칙으로 1일차부터 ${p.totalDays}일차까지 모든 날을 새로 짭니다.

${BONGTOUR_FREE_DAY_VOICE_BLOCK}

[일정 짜는 규칙]
- persona: '${p.cityNameKo}' 일반 자유여행객 기준으로 mixed / couple / with-parents / with-kids 중 하나를 고릅니다.
- 1일차: 공항 도착 → 호텔 체크인 → 저녁·산책 정도로 가볍게. 먼 근교로 보내지 않습니다.
- 마지막 날: 호텔 체크아웃 → 공항 가는 길 한두 곳 → 공항. 공항과 반대 방향 명소를 넣지 않습니다.
- 하루 동선은 한 권역 안에서 짭니다(하루 한 권역). 근교(예: 오사카 상품의 교토·나라)는 하루를 통째로 쓸 때만 넣고, 같은 날 두 권역을 오가지 않습니다.
  · 예외 1: 호텔 주소가 상품 정보에 있을 때, 그 주소에서 걸어서 갈 수 있는 곳은 숙소와 같은 권역으로 봅니다.
  · 예외 2: 테마파크처럼 하루를 다 쓰는 날은 돌아오는 길에 저녁을 먹는 것까지 됩니다. 이때도 "숙소 근처"라고 쓰지 않고 "돌아오는 길"로만 씁니다.
- 숙소 위치: 위 [호텔]에 주소·위치가 없으면 "숙소 근처", "숙소와 가까운", "호텔 바로 옆"처럼 숙소와의 거리를 말하지 않습니다.
- 교통(transport) 칸 설명도 같은 말투로 씁니다("~하시면 돼요"). "~를 시작합니다", "~를 준비합니다" 같은 설명체는 쓰지 않습니다.
- 같은 명소를 두 날 이상 넣지 않습니다.
- 일차 title: 그날 대표 장소가 들어간 짧은 한국어 제목(8~24자). 시적 수식(설레는, 꿈과 환상의…)은 쓰지 않습니다.
- 일차 summary: 3~4문장, 동선 순서대로. summary에 나온 장소와 activities.location이 같아야 합니다.
- activities: ${activityRule}, 동선 순서대로. 카테고리는 transport / hotel / meal / attraction / shopping 다섯 개만 씁니다.
- **location 필수 형식:** attraction은 한글명 (English landmark name) — 괄호 안 **영문 랜드마크** 필수 (예: "청수사 (Kiyomizu-dera Temple)", "바나힐 (Ba Na Hills)"). meal은 상호를 지어내지 않고 "근처 라멘집", "시장 안 노점"처럼 일반 명사로만 쓰고 영문 괄호를 붙이지 않습니다. transport·hotel은 공항·호텔명 한글만.
- **동선·imageKeyword(시스템 자동):** 예시 일정 각 일차 activities가 그날 **동선**이다. 등록 후 시스템은 그날 **attraction location의 괄호 영문 랜드마크**로 imageKeyword를 만든다(일차마다 다른 명소). 식사·쇼핑 상호명(식당·약국·면세점)은 imageKeyword로 쓰지 않는다. 도시명·공항명만 쓰지 말 것.
- dayCityKey는 시스템이 그날 장소로 다시 정합니다. 그날 실제로 머무는 도시를 영문 소문자로 적습니다(예: 교토 하루면 "kyoto").
- 숫자 필드는 비웁니다: startTime, durationMinutes, estimatedCostKrw, estimatedCostNote, transportDuration 은 모두 null. transportMode는 "도보"/"지하철"/"버스"/"택시"/"페리" 중 하나 또는 null.
- days 배열 길이 = ${p.totalDays}일 (dayNumber 1부터 연속). 빈 날 없이 모든 날에 summary 3~4문장과 activities를 넣습니다.
- 가격·요금·최저가·할인 이야기는 하지 않습니다.
- 모든 텍스트는 한국어입니다.

${PLACE_NAME_SPELLING_PROMPT_RULE}

[출력] 유효한 JSON 객체 하나만. markdown 코드블록(\`\`\`json)·설명·주석 금지.
{
  "title": "도시 X일 한국어 제목(호텔명 포함, 상품 정보의 사실만)",
  "summary": "상품 요약 2문장: 이 여행 동선의 결 한 문장 + '아래는 참고용 예시 일정이라 순서는 편하게 바꾸셔도 돼요' 취지 한 문장. 숫자 없음.",
  "persona": "mixed|couple|with-parents|with-kids",
  "days": [
    {
      "dayNumber": 1,
      "title": "그날 대표 장소가 들어간 짧은 제목",
      "summary": "3~4문장, 동선 순서, 장소마다 이유 한두 마디, 숫자·단정어 없음",
      "dayCityKey": "${p.cityKey}",
      "activities": [
        { "order": 1, "category": "attraction", "title": "...", "description": "한 문장, 숫자 없음", "location": "한글명 (English name)", "startTime": null, "durationMinutes": null, "estimatedCostKrw": null, "estimatedCostNote": null, "transportMode": "지하철", "transportDuration": null }
      ]
    }
  ]
}

[좋은 예 — 형식 참고용, 그대로 베끼지 말 것]
"첫날은 짐만 풀고 바로 신세카이로 나가 보세요. 츠텐카쿠 아래 골목은 해가 진 뒤에 간판 불이 들어와야 제맛이에요. 저녁은 그 골목 쿠시카츠집에서 가볍게 드시면 첫날 일정이 편해요."
[나쁜 예 — 이렇게 쓰지 않음]
"신세카이 · 츠텐카쿠 · 쿠시카츠. 공항에서 시내까지 약 35분 만에 이동할 수 있습니다. 최고의 야경을 만끽하세요."`
}

async function generateGeminiText(opts: {
  model: string
  prompt: string
  temperature?: number
  maxOutputTokens?: number
}): Promise<GeminiGenerateResult> {
  const genAI = getGenAI()
  const model = genAI.getGenerativeModel({ model: opts.model || getModelName() })
  const result = await model.generateContent(
    {
      contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        maxOutputTokens: opts.maxOutputTokens ?? FIT_ITINERARY_MAX_OUTPUT_TOKENS,
        ...( { responseMimeType: 'application/json' } as { responseMimeType?: string }),
      },
    },
    geminiTimeoutOpts(300_000),
  )
  const response = result.response
  const text = extractGeminiResponseText(response)
  return {
    text,
    finishReason: response.candidates?.[0]?.finishReason ?? null,
    usageMetadata: response.usageMetadata,
    partCount: response.candidates?.[0]?.content?.parts?.length ?? 0,
  }
}

/** thinking model — response.text()가 비면 non-thought parts에서 JSON 추출 */
function extractGeminiResponseText(response: {
  text: () => string
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> }
  }>
}): string {
  try {
    const direct = response.text()?.trim()
    if (direct) return direct
  } catch {
    /* fall through — thinking-only 응답 등 */
  }
  const parts = response.candidates?.[0]?.content?.parts ?? []
  const fromParts = parts
    .filter((p) => !p.thought && typeof p.text === 'string' && p.text.trim())
    .map((p) => p.text!.trim())
    .join('\n')
  if (fromParts) return fromParts
  return parts
    .filter((p) => typeof p.text === 'string' && p.text.trim())
    .map((p) => p.text!.trim())
    .join('\n')
}

type GenerateGeminiTextUsage = {
  promptTokenCount?: number
  candidatesTokenCount?: number
  thoughtsTokenCount?: number
  totalTokenCount?: number
}

type GeminiGenerateResult = {
  text: string
  finishReason: string | null
  usageMetadata?: GenerateGeminiTextUsage
  partCount?: number
}

function logGeminiRawFailure(
  productId: string,
  raw: GeminiGenerateResult,
  err?: unknown,
): void {
  const rawText = raw.text ?? ''
  const len = rawText.length
  console.error(`[fit-itinerary-generate] gemini_failed_detail productId=${productId}`, {
    finishReason: raw.finishReason,
    responseLength: len,
    rawSnippet: rawText.substring(0, 1000),
    rawTail: rawText.substring(Math.max(0, len - 500)),
    partCount: raw.partCount,
    promptTokenCount: raw.usageMetadata?.promptTokenCount,
    candidatesTokenCount: raw.usageMetadata?.candidatesTokenCount,
    thoughtsTokenCount: raw.usageMetadata?.thoughtsTokenCount,
    totalTokenCount: raw.usageMetadata?.totalTokenCount,
    error: err instanceof Error ? err.message : err,
  })
  logLlmJsonRawDebug(`fit-itinerary:${productId}`, rawText, err)
}

export { fitGeminiResponseToKeywordDays, parseFitItineraryGeminiJson }
export type { FitItineraryGeminiResponse } from '@/lib/fit-itinerary-gemini-parse'

/** 기본값 4일 없음 — 모르면 0(호출부가 생성하지 않음) */
function inferTotalDaysFromDuration(
  duration: string | null | undefined,
  scheduleLen: number,
  title?: string | null,
): number {
  const r = resolveFitTotalDays({ duration, title, itineraryDayCount: scheduleLen })
  return r?.days ?? 0
}

function inferCountryCodeFromHaystack(hay: string): string {
  const lower = hay.toLowerCase()
  for (const [key, code] of Object.entries(countryCodeMap)) {
    if (lower.includes(key.replace(/_/g, ' ')) || lower.includes(key)) return code
  }
  if (/대만|타이완|taiwan/i.test(hay)) return 'TW'
  if (/일본|japan/i.test(hay)) return 'JP'
  if (/베트남|vietnam/i.test(hay)) return 'VN'
  if (/태국|thailand/i.test(hay)) return 'TH'
  if (/싱가포르|singapore/i.test(hay)) return 'SG'
  if (/홍콩|hong\s*kong/i.test(hay)) return 'HK'
  return 'XX'
}

export function registerParsedToFitPromptProduct(parsed: RegisterParsed): PromptProduct {
  const cityNameKo =
    parsed.primaryDestination?.trim() || parsed.destination?.trim() || ''
  const hay = [parsed.title, cityNameKo, parsed.destination, parsed.primaryDestination].filter(Boolean).join(' ')
  const scheduleJson =
    (parsed.schedule?.length ?? 0) > 0
      ? buildProductScheduleJsonForDb(
          parsed.schedule.map((r) => ({
            day: r.day,
            title: r.title,
            description: r.description,
            routeText: r.routeText ?? null,
            imageKeyword: r.imageKeyword,
            imageKeyword2: r.imageKeyword2 ?? null,
          })),
        )
      : null
  const totalDays = inferTotalDaysFromDuration(parsed.duration, parsed.schedule?.length ?? 0, parsed.title)
  return {
    title: parsed.title ?? '',
    cityNameKo,
    cityKey: '',
    countryCode: inferCountryCodeFromHaystack(hay),
    duration: parsed.duration ?? '',
    totalDays,
    airline: parsed.airline ?? null,
    hotelSummaryText: parsed.hotelSummaryText ?? null,
    airtelHotelInfoJson: parsed.airtelHotelInfoJson ?? null,
    schedule: scheduleJson,
  }
}

export async function generateFitItineraryGeminiResponse(
  prompt: string,
  logLabel: string,
): Promise<GeminiGenerateResult> {
  const model = fitItineraryModelName()
  let geminiResult = await generateGeminiText({
    model,
    prompt,
    temperature: 0.7,
    maxOutputTokens: FIT_ITINERARY_MAX_OUTPUT_TOKENS,
  })
  try {
    parseFitItineraryGeminiJson(geminiResult.text, logLabel)
    return geminiResult
  } catch (firstError) {
    const shouldRetry =
      geminiResult.finishReason === 'MAX_TOKENS' ||
      (geminiResult.text.length > 0 && !geminiResult.text.trimEnd().endsWith('}'))
    if (!shouldRetry) {
      logGeminiRawFailure(logLabel, geminiResult, firstError)
      throw firstError
    }
    logGeminiRawFailure(logLabel, geminiResult, firstError)
    console.warn(
      `[fit-itinerary-generate] retry label=${logLabel} reason=${geminiResult.finishReason ?? 'truncated_json'} tokens=${FIT_ITINERARY_MAX_OUTPUT_TOKENS_RETRY}`,
    )
    geminiResult = await generateGeminiText({
      model,
      prompt,
      temperature: 0.7,
      maxOutputTokens: FIT_ITINERARY_MAX_OUTPUT_TOKENS_RETRY,
    })
    parseFitItineraryGeminiJson(geminiResult.text, logLabel)
    return geminiResult
  }
}

export type PersistFitItineraryOptions = {
  /** 일수가 틀린 기존 master 를 바꿀 때만 true */
  replaceExisting?: boolean
}

export async function persistFitItineraryFromGeminiJson(
  productId: string,
  geminiJsonText: string,
  opts: PersistFitItineraryOptions = {},
): Promise<GenerateFitItineraryResult> {
  const existing = await prisma.fitItineraryMaster.findUnique({
    where: { productId },
    select: { id: true },
  })
  if (existing && !opts.replaceExisting) {
    return { success: false, reason: 'already_exists', masterId: existing.id }
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      productType: true,
      listingKind: true,
      title: true,
      cityKey: true,
      primaryDestination: true,
      destination: true,
      duration: true,
      schedule: true,
      hotelSummaryText: true,
      _count: { select: { itineraryDays: true } },
    },
  })
  if (!product || !isAirHotelFitItineraryProduct(product)) {
    return { success: false, reason: 'not_airtel' }
  }

  let parsed: FitItineraryGeminiResponse
  try {
    parsed = parseFitItineraryGeminiJson(geminiJsonText, productId)
  } catch (error) {
    return { success: false, reason: 'gemini_failed', error, detail: errMsg(error) }
  }
  // REGRESSION-FREEZE[fit-gemini-recommended-itinerary-1101]: 모든 일차 채움·일수 일치 아니면 저장 안 함 — manifest
  const resolved = resolveFitTotalDays({
    duration: product.duration,
    title: product.title,
    itineraryDayCount: product._count?.itineraryDays ?? 0,
    schedule: product.schedule,
  })
  const expectedDays = resolved?.days ?? parsed.days.length
  const v = validateFitItineraryGeminiDays(parsed, expectedDays, {
    hotelKnown: !!product.hotelSummaryText?.trim(),
  })
  if (!v.ok) {
    return { success: false, reason: 'validation_failed', detail: v.issues.slice(0, 8).join(',') }
  }
  // REGRESSION-FREEZE[place-name-spelling-n1]: Gemini 추천일정 사후 검사 — certain 사전만 교정(비용 필드 불변)
  parsed = applyPlaceNameSpellingToFitGemini(parsed)
  // 톤 1031: dayCityKey 는 모델 값이 아니라 그날 장소(권역 표)로 — 교토 하루는 kyoto
  parsed = withCodeResolvedDayCityKeys(parsed, product.cityKey)

  const cityNameKo =
    product.primaryDestination?.trim() || product.destination?.trim() || product.cityKey || ''
  const masterId = cuid()
  try {
    await prisma.$transaction(async (tx) => {
      // 일수가 틀린 기존 추천일정(예: 기본값 4일로 만든 10일 상품)은 같은 트랜잭션에서 바꾼다
      if (opts.replaceExisting && existing) {
        await tx.fitItineraryMaster.deleteMany({ where: { id: existing.id, productId } })
      }
      await tx.fitItineraryMaster.create({
        data: {
          id: masterId,
          productId,
          cityKey: product.cityKey ?? '',
          cityNameKo,
          countryCode: inferCountryCodeFromHaystack(
            [product.title, cityNameKo, product.destination, product.primaryDestination].filter(Boolean).join(' '),
          ),
          persona: parsed.persona,
          totalDays: parsed.days.length,
          title: parsed.title,
          summary: parsed.summary,
          generatedBy: 'gemini-v3',
          status: 'published',
          publishedAt: new Date(),
        },
      })

      for (const day of parsed.days) {
        const dayId = cuid()
        await tx.fitItineraryDay.create({
          data: {
            id: dayId,
            masterId,
            dayNumber: day.dayNumber,
            title: day.title,
            summary: day.summary,
            dayCityKey: day.dayCityKey,
          },
        })
        const activities = [...(day.activities ?? [])].sort((a, b) => a.order - b.order)
        for (const act of activities) {
          await tx.fitItineraryActivity.create({
            data: {
              id: cuid(),
              dayId,
              order: act.order,
              category: act.category,
              title: act.title,
              description: act.description,
              location: act.location,
              startTime: act.startTime,
              durationMinutes: act.durationMinutes,
              estimatedCostKrw: act.estimatedCostKrw,
              estimatedCostNote: act.estimatedCostNote,
              transportMode: act.transportMode,
              transportDuration: act.transportDuration,
            },
          })
        }
      }
    }, { timeout: 30_000 })
  } catch (error) {
    console.error(`[fit-itinerary-generate] db_failed productId=${productId}`, error)
    return { success: false, reason: 'db_failed', error }
  }

  try {
    await syncScheduleImageKeywordsFromFitItinerary(productId, fitGeminiResponseToKeywordDays(parsed))
  } catch (syncErr) {
    console.error(`[fit-itinerary-generate] schedule_keyword_sync_failed productId=${productId}`, syncErr)
  }

  return { success: true, masterId }
}

function errMsg(e: unknown): string {
  return (e instanceof Error ? e.message : String(e ?? '')).replace(/key=[^&\s]+/gi, 'key=[redacted]').slice(0, 240)
}

const FIT_ITINERARY_GENERATE_ATTEMPTS = 2

export async function generateFitItineraryForProduct(
  productId: string,
  opts: { replaceIfDaysMismatch?: boolean } = {},
): Promise<GenerateFitItineraryResult> {
  const existing = await prisma.fitItineraryMaster.findUnique({
    where: { productId },
    select: { id: true, totalDays: true },
  })
  if (existing && !opts.replaceIfDaysMismatch) {
    return { success: false, reason: 'already_exists', masterId: existing.id }
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      productType: true,
      listingKind: true,
      primaryDestination: true,
      destination: true,
      cityKey: true,
      countryKey: true,
      duration: true,
      airline: true,
      hotelSummaryText: true,
      airtelHotelInfoJson: true,
      schedule: true,
      _count: { select: { itineraryDays: true } },
    },
  })
  if (!product) {
    return { success: false, reason: 'not_airtel', error: `Product not found: ${productId}` }
  }
  if (!isAirHotelFitItineraryProduct(product)) {
    return { success: false, reason: 'not_airtel' }
  }

  // REGRESSION-FREEZE[fit-gemini-recommended-itinerary-1101]: 일수 기본값 4 금지 — duration·원문 행 수·schedule 로만 — manifest
  const resolved = resolveFitTotalDays({
    duration: product.duration,
    title: product.title,
    itineraryDayCount: product._count?.itineraryDays ?? 0,
    schedule: product.schedule,
  })
  if (existing && (!resolved || existing.totalDays === resolved.days)) {
    return { success: false, reason: 'already_exists', masterId: existing.id }
  }
  if (!resolved) {
    const fail: GenerateFitItineraryResult = {
      success: false,
      reason: 'days_unknown',
      detail: 'duration·원문 일정표·schedule 어디에도 일수가 없음',
    }
    await recordItineraryGenerationStatus(productId, { ok: false, reason: fail.reason, detail: fail.detail })
    return fail
  }
  const totalDays = resolved.days

  const countryCode = countryCodeMap[product.countryKey ?? ''] ?? 'XX'
  const cityNameKo =
    product.primaryDestination?.trim() || product.destination?.trim() || product.cityKey || ''

  const promptInput: PromptProduct = {
    title: product.title ?? '',
    cityNameKo,
    cityKey: product.cityKey ?? '',
    countryCode,
    duration: product.duration?.trim() || `${totalDays}일`,
    totalDays,
    airline: product.airline,
    hotelSummaryText: product.hotelSummaryText,
    airtelHotelInfoJson: product.airtelHotelInfoJson,
    schedule: null,
  }

  const prompt = buildAirtelPrompt(promptInput)
  let last: GenerateFitItineraryResult = { success: false, reason: 'gemini_failed' }
  // 실패하면 한 번 더 부른다. 그래도 안 되면 저장하지 않고 사유를 rawMeta 에 남긴다(매시간 백필이 다시 시도).
  for (let attempt = 1; attempt <= FIT_ITINERARY_GENERATE_ATTEMPTS; attempt++) {
    try {
      const geminiResult = await generateFitItineraryGeminiResponse(prompt, productId)
      const res = await persistFitItineraryFromGeminiJson(productId, geminiResult.text, {
        replaceExisting: !!existing,
      })
      if (res.success) {
        await recordItineraryGenerationStatus(productId, { ok: true })
        return res
      }
      last = res
      if (res.reason === 'already_exists' || res.reason === 'not_airtel' || res.reason === 'db_failed') break
      console.warn(
        `[fit-itinerary-generate] attempt ${attempt} failed productId=${productId} reason=${res.reason} ${res.detail ?? ''}`,
      )
    } catch (error) {
      console.error(`[fit-itinerary-generate] gemini_failed productId=${productId} attempt=${attempt}`, error)
      last = { success: false, reason: 'gemini_failed', error, detail: errMsg(error) }
    }
  }
  if (last.reason !== 'already_exists') {
    await recordItineraryGenerationStatus(productId, {
      ok: false,
      reason: last.reason ?? 'unknown',
      detail: last.detail ?? errMsg(last.error),
    })
  }
  return last
}

/** Gemini 추천일정 텍스트(제목·요약·일차·활동) 지명 사후 교정 — estimatedCostKrw/estimatedCostNote 등 비용은 그대로 */
export function applyPlaceNameSpellingToFitGemini(parsed: FitItineraryGeminiResponse): FitItineraryGeminiResponse {
  const t = normalizePlaceNameSpellingText
  return {
    ...parsed,
    title: t(parsed.title),
    summary: t(parsed.summary),
    days: parsed.days.map((d) => ({
      ...d,
      title: t(d.title),
      summary: t(d.summary),
      activities: (d.activities ?? []).map((a) => ({
        ...a,
        title: t(a.title),
        description: t(a.description),
        location: t(a.location),
      })),
    })),
  }
}

/** 톤 1031: 일차 dayCityKey 를 코드 권역 표로 다시 정한다(모델 값은 상품 cityKey 가 비었을 때만). */
export function withCodeResolvedDayCityKeys(
  parsed: FitItineraryGeminiResponse,
  productCityKey: string | null | undefined,
): FitItineraryGeminiResponse {
  return {
    ...parsed,
    days: parsed.days.map((d) => ({
      ...d,
      dayCityKey: resolveFitDayCityKey({
        activities: d.activities ?? [],
        productCityKey,
        modelDayCityKey: d.dayCityKey,
      }),
    })),
  }
}
