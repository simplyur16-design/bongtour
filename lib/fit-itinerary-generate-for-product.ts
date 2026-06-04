/**
 * 단일 Product에 FitItineraryMaster + Day + Activity 생성 (Gemini v3 JSON).
 * 자유여행(productType='airtel') 전용 — 등록 hook·backfill cron SSOT.
 */
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import {
  GEMINI_MODEL,
  geminiTimeoutOpts,
  getGenAI,
  getModelName,
} from '@/lib/gemini-client'
import { syncScheduleImageKeywordsFromFitItinerary } from '@/lib/fit-itinerary-sync-schedule-image-keywords'
import type { FitItineraryDayForKeyword } from '@/lib/fit-itinerary-pick-day-image-keyword'
import { logLlmJsonRawDebug, parseLlmJsonObject } from '@/lib/llm-json-extract'
import { buildProductScheduleJsonForDb } from '@/lib/schedule-image-keyword-persist'
import type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'

/** 다일정 Fit JSON — season(4096)과 달리 5~6일·activities 다수 시 8k+ chars. 기본 16384 */
const FIT_ITINERARY_MAX_OUTPUT_TOKENS = Math.max(
  4096,
  Number(process.env.FIT_ITINERARY_MAX_OUTPUT_TOKENS) || 16384,
)
const FIT_ITINERARY_MAX_OUTPUT_TOKENS_RETRY = Math.max(
  FIT_ITINERARY_MAX_OUTPUT_TOKENS,
  Number(process.env.FIT_ITINERARY_MAX_OUTPUT_TOKENS_RETRY) || 32768,
)

const VALID_PERSONAS = new Set(['mixed', 'couple', 'with-parents', 'with-kids'])
const VALID_CATEGORIES = new Set(['transport', 'hotel', 'meal', 'attraction', 'shopping'])

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
  reason?: 'already_exists' | 'not_airtel' | 'gemini_failed' | 'db_failed'
  error?: unknown
}

type GeminiActivity = {
  order: number
  category: 'transport' | 'hotel' | 'meal' | 'attraction' | 'shopping'
  title: string
  description: string
  location: string
  startTime: string
  durationMinutes: number
  estimatedCostKrw: number
  estimatedCostNote: string
  transportMode: string | null
  transportDuration: string | null
}

type GeminiDay = {
  dayNumber: number
  title: string
  summary: string
  dayCityKey: string
  activities: GeminiActivity[]
}

export type FitItineraryGeminiResponse = {
  title: string
  summary: string
  persona: 'mixed' | 'couple' | 'with-parents' | 'with-kids'
  days: GeminiDay[]
}

type GeminiResponse = FitItineraryGeminiResponse

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

function schedulePreview(schedule: string | null, maxLen = 4000): string {
  if (!schedule?.trim()) return '없음'
  const t = schedule.trim()
  return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t
}

export function buildAirtelPrompt(p: PromptProduct): string {
  return `당신은 가오슝 v3 패턴 그대로 자유여행 예시 일정을 만드는 봉투어 큐레이터입니다.

[상품 정보]
- 제목: ${p.title}
- 도시: ${p.cityNameKo} (cityKey: ${p.cityKey}, 국가: ${p.countryCode})
- 일정: ${p.duration} (총 ${p.totalDays}일)
- 항공사: ${p.airline ?? '미지정'}
- 호텔: ${p.hotelSummaryText ?? p.airtelHotelInfoJson ?? '에어텔 포함'}
- 기존 스케줄: ${schedulePreview(p.schedule)}

[작성 규칙 — 가오슝 v3 활동 패턴 + 봉투어 2문장 브리프]
- persona 자동 결정: '${p.cityNameKo}' 도시의 일반 자유여행객 페르소나 (mixed / couple / with-parents / with-kids 중 1)
- 각 day = title(시적 한국어), summary(정확히 2문장 한국어), activities 3~6개
- day.summary 2문장 구조: ① 오늘 동선·핵심 체험(친근한 권유형, 「~해 보세요」「~즐기기 좋은 날」). ② 이동·시간·비용·준비물 중 실용 팁 1가지(부드러운 조언). 과장·「필수」「무조건」·패키지 가이드 동행 표현 금지. 문장 사이 마침표만(줄바꿈 없음), 합계 50~90자.
- 상품 최상위 summary: 정확히 2문장 — ① 이 여행의 매력·동선 요약 ② 아래는 참고용 예시 일정이며 순서·시간은 자유롭게 조정 가능함을 짧게 안내
- 카테고리 5개만 사용: transport(공항·이동) / hotel(체크인) / meal(식사·야시장 미식) / attraction(관광·전망대·사찰) / shopping(쇼핑·기념품)
- Day 1 첫 활동 = 공항 도착(transport), 호텔 체크인(hotel), 야시장/저녁(meal)
- Day 마지막 = 공항 출국(transport)
- startTime = "HH:MM" 24시간 (예: "10:00", "15:55")
- durationMinutes = 30 ~ 180
- estimatedCostKrw = 정수 (0 = 무료/포함)
- estimatedCostNote = "현지 통화 약 $XX 기준, 현지 실제 가격은 다를 수 있음"
- transportMode = "도보" / "MRT" / "택시" / "버스" / "페리" 또는 null (hotel/meal일 때 null 가능)
- transportDuration = "10분" 등 한국어 + 숫자
- 모든 텍스트 한국어
- **location 필수 형식(관광·쇼핑·식사):** 한글명 (English landmark name) — 괄호 안 **영문 고유명** 필수 (예: "도톤보리 (Dotonbori)", "청수사 (Kiyomizu-dera Temple)"). transport·hotel은 공항·호텔명 한글만 가능
- 음식점은 추천 메뉴 1~2개 포함
- 가족·연인·부모 등 페르소나 언급 활동 1~2개 포함
- 야경/포토존 1개 포함
- days 배열 길이 = ${p.totalDays}일 (dayNumber 1부터 연속)

[출력] 아래 JSON만, 다른 설명 없이:
- 응답은 반드시 유효한 JSON 객체 하나만. markdown 코드블록(\`\`\`json), 설명 문장, 주석 절대 금지.
{
  "title": "도시 X일 페르소나에 맞는 한국어 제목 (호텔명 포함)",
  "summary": "상품 2문장 요약(매력+예시일정 참고·자유 조정 안내)",
  "persona": "mixed|couple|with-parents|with-kids",
  "days": [
    {
      "dayNumber": 1,
      "title": "Day 시적 한국어 제목",
      "summary": "Day 2문장(동선+실용팁). 예: 오후엔 ○○을 걸으며 ○○을 즐겨 보세요. 저녁엔 ○○을 챙기시면 이동이 수월해요.",
      "dayCityKey": "${p.cityKey}",
      "activities": [
        { "order": 1, "category": "transport", "title": "...", "description": "...", "location": "...", "startTime": "HH:MM", "durationMinutes": 60, "estimatedCostKrw": 15000, "estimatedCostNote": "...", "transportMode": "택시", "transportDuration": "35분" }
      ]
    }
  ]
}`
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

function parseGeminiJson(text: string, logLabel: string): GeminiResponse {
  const parsed = parseLlmJsonObject<GeminiResponse>(text, { logLabel: `fit-itinerary:${logLabel}` })
  if (!parsed?.days?.length) throw new Error('days 배열이 비어 있습니다.')
  if (!VALID_PERSONAS.has(parsed.persona)) {
    throw new Error(`잘못된 persona: ${String(parsed.persona)}`)
  }
  for (const day of parsed.days) {
    for (const act of day.activities ?? []) {
      if (!VALID_CATEGORIES.has(act.category)) {
        throw new Error(`잘못된 category: ${act.category} (day ${day.dayNumber})`)
      }
    }
  }
  return parsed
}

export function parseFitItineraryGeminiJson(text: string, logLabel: string): FitItineraryGeminiResponse {
  return parseGeminiJson(text, logLabel)
}

export function fitGeminiResponseToKeywordDays(response: FitItineraryGeminiResponse): FitItineraryDayForKeyword[] {
  return (response.days ?? []).map((d) => ({
    dayNumber: d.dayNumber,
    title: d.title,
    summary: d.summary,
    dayCityKey: d.dayCityKey,
    activities: (d.activities ?? []).map((a) => ({
      order: a.order,
      category: a.category,
      title: a.title,
      description: a.description,
      location: a.location,
    })),
  }))
}

function inferTotalDaysFromDuration(duration: string | null | undefined, scheduleLen: number): number {
  const fromDur = parseInt(String(duration ?? '').match(/(\d+)\s*일/)?.[1] ?? '', 10)
  if (Number.isFinite(fromDur) && fromDur >= 1) return fromDur
  if (scheduleLen >= 1) return scheduleLen
  return 4
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
  const totalDays = inferTotalDaysFromDuration(parsed.duration, parsed.schedule?.length ?? 0)
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
    parseGeminiJson(geminiResult.text, logLabel)
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
    parseGeminiJson(geminiResult.text, logLabel)
    return geminiResult
  }
}

export async function persistFitItineraryFromGeminiJson(
  productId: string,
  geminiJsonText: string,
): Promise<GenerateFitItineraryResult> {
  const existing = await prisma.fitItineraryMaster.findUnique({
    where: { productId },
    select: { id: true },
  })
  if (existing) {
    return { success: false, reason: 'already_exists', masterId: existing.id }
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      productType: true,
      title: true,
      cityKey: true,
      primaryDestination: true,
      destination: true,
    },
  })
  if (!product || product.productType !== 'airtel') {
    return { success: false, reason: 'not_airtel' }
  }

  let parsed: GeminiResponse
  try {
    parsed = parseGeminiJson(geminiJsonText, productId)
  } catch (error) {
    return { success: false, reason: 'gemini_failed', error }
  }

  const cityNameKo =
    product.primaryDestination?.trim() || product.destination?.trim() || product.cityKey || ''
  const masterId = cuid()
  try {
    await prisma.$transaction(async (tx) => {
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
            dayCityKey: day.dayCityKey || product.cityKey || '',
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
    })
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

export async function generateFitItineraryForProduct(
  productId: string,
): Promise<GenerateFitItineraryResult> {
  const existing = await prisma.fitItineraryMaster.findUnique({
    where: { productId },
    select: { id: true },
  })
  if (existing) {
    return { success: false, reason: 'already_exists', masterId: existing.id }
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      productType: true,
      primaryDestination: true,
      destination: true,
      cityKey: true,
      countryKey: true,
      duration: true,
      airline: true,
      hotelSummaryText: true,
      airtelHotelInfoJson: true,
      schedule: true,
    },
  })
  if (!product) {
    return { success: false, reason: 'not_airtel', error: `Product not found: ${productId}` }
  }
  if (product.productType !== 'airtel') {
    return { success: false, reason: 'not_airtel' }
  }

  const countryCode = countryCodeMap[product.countryKey ?? ''] ?? 'XX'
  const totalDays = parseInt(product.duration?.match(/(\d+)일/)?.[1] ?? '4', 10)
  const cityNameKo =
    product.primaryDestination?.trim() || product.destination?.trim() || product.cityKey || ''

  const promptInput: PromptProduct = {
    title: product.title ?? '',
    cityNameKo,
    cityKey: product.cityKey ?? '',
    countryCode,
    duration: product.duration ?? '',
    totalDays,
    airline: product.airline,
    hotelSummaryText: product.hotelSummaryText,
    airtelHotelInfoJson: product.airtelHotelInfoJson,
    schedule: product.schedule,
  }

  const prompt = buildAirtelPrompt(promptInput)
  try {
    const geminiResult = await generateFitItineraryGeminiResponse(prompt, productId)
    return persistFitItineraryFromGeminiJson(productId, geminiResult.text)
  } catch (error) {
    console.error(`[fit-itinerary-generate] gemini_failed productId=${productId}`, error)
    return { success: false, reason: 'gemini_failed', error }
  }
}
