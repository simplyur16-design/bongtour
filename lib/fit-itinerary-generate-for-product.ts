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
import { extractFirstBalancedJsonObject, stripLlmMarkdownJsonFence } from '@/lib/llm-json-extract'

const FIT_ITINERARY_MAX_OUTPUT_TOKENS = 4096

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

type GeminiResponse = {
  title: string
  summary: string
  persona: 'mixed' | 'couple' | 'with-parents' | 'with-kids'
  days: GeminiDay[]
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

[작성 규칙 — 가오슝 v3와 동일 패턴]
- persona 자동 결정: '${p.cityNameKo}' 도시의 일반 자유여행객 페르소나 (mixed / couple / with-parents / with-kids 중 1)
- 각 day = title(시적 한국어), summary(1문장 한국어), activities 3~6개
- 카테고리 5개만 사용: transport(공항·이동) / hotel(체크인) / meal(식사·야시장 미식) / attraction(관광·전망대·사찰) / shopping(쇼핑·기념품)
- Day 1 첫 활동 = 공항 도착(transport), 호텔 체크인(hotel), 야시장/저녁(meal)
- Day 마지막 = 공항 출국(transport)
- startTime = "HH:MM" 24시간 (예: "10:00", "15:55")
- durationMinutes = 30 ~ 180
- estimatedCostKrw = 정수 (0 = 무료/포함)
- estimatedCostNote = "현지 통화 약 $XX 기준, 현지 실제 가격은 다를 수 있음"
- transportMode = "도보" / "MRT" / "택시" / "버스" / "페리" 또는 null (hotel/meal일 때 null 가능)
- transportDuration = "10분" 등 한국어 + 숫자
- 모든 텍스트 한국어 (장소명은 현지어 + 한국어 병기 가능: "리우허 야시장(六合夜市)")
- 음식점은 추천 메뉴 1~2개 포함
- 가족·연인·부모 등 페르소나 언급 활동 1~2개 포함
- 야경/포토존 1개 포함
- days 배열 길이 = ${p.totalDays}일 (dayNumber 1부터 연속)

[출력] 아래 JSON만, 다른 설명 없이:
{
  "title": "도시 X일 페르소나에 맞는 한국어 제목 (호텔명 포함)",
  "summary": "1문장 한국어 요약",
  "persona": "mixed|couple|with-parents|with-kids",
  "days": [
    {
      "dayNumber": 1,
      "title": "Day 시적 한국어 제목",
      "summary": "Day 1문장 한국어",
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
}): Promise<string> {
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
  return result.response.text()
}

function parseGeminiJson(text: string): GeminiResponse {
  const stripped = stripLlmMarkdownJsonFence(text.trim())
  const objStr =
    extractFirstBalancedJsonObject(stripped) ?? extractFirstBalancedJsonObject(text)
  if (!objStr) throw new Error('응답에서 JSON 객체를 찾지 못했습니다.')
  const parsed = JSON.parse(objStr) as GeminiResponse
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

  let parsed: GeminiResponse
  try {
    const responseText = await generateGeminiText({
      model: fitItineraryModelName(),
      prompt: buildAirtelPrompt(promptInput),
      temperature: 0.7,
      maxOutputTokens: FIT_ITINERARY_MAX_OUTPUT_TOKENS,
    })
    parsed = parseGeminiJson(responseText)
  } catch (error) {
    console.error(`[fit-itinerary-generate] gemini_failed productId=${productId}`, error)
    return { success: false, reason: 'gemini_failed', error }
  }

  const masterId = cuid()
  try {
    await prisma.$transaction(async (tx) => {
      await tx.fitItineraryMaster.create({
        data: {
          id: masterId,
          productId,
          cityKey: product.cityKey ?? '',
          cityNameKo,
          countryCode,
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

  return { success: true, masterId }
}
