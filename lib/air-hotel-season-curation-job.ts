/**
 * /travel/air-hotel 시즌 큐레이션 — Gemini job + DB upsert (25일 cron 2단계에서 호출).
 */
import { revalidatePath, revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { extractFirstBalancedJsonObject, stripLlmMarkdownJsonFence } from '@/lib/llm-json-extract'
import { getGenAI, geminiTimeoutOpts } from '@/lib/gemini-client'
import { pickAirHotelSeasonHeroUrl } from '@/lib/air-hotel-hero-image-pick'
import {
  AIR_HOTEL_SEASON_CARD_COUNTS,
  AIR_HOTEL_SEASON_POOL_SIZE,
  getAirHotelCycleIdForNow,
  getAirHotelCycleStartDate,
  getAirHotelExposureMonthKeys,
} from '@/lib/air-hotel-season-curation-constants'

const JOB_MODEL =
  process.env.GEMINI_CURATION_MODEL?.trim() ||
  process.env.GEMINI_SEASON_CURATION_MODEL?.trim() ||
  process.env.GEMINI_MODEL?.trim() ||
  'gemini-2.5-flash'

export type AirHotelSeasonCurationJobResult = {
  cycleId: string
  ok: true
  linkedCount: number
  heroOk: boolean
  messageOk: boolean
}

type PoolProduct = { id: string; title: string; country: string | null }
type MonthCuration = { productIds: string[]; message: string }

function startOfTodayKst(): Date {
  const seoul = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  seoul.setHours(0, 0, 0, 0)
  return seoul
}

function monthLabelShort(monthKey: string): string {
  return String(parseInt(monthKey.split('-')[1] ?? '0', 10))
}

function formatMonthKeysForPrompt(monthKeys: string[]): string {
  const y = monthKeys[0]?.split('-')[0] ?? ''
  const months = monthKeys.map(monthLabelShort).join('·')
  return `${y}년 ${months}월`
}

function expectedCounts(): [number, number, number] {
  return [
    AIR_HOTEL_SEASON_CARD_COUNTS.plus1,
    AIR_HOTEL_SEASON_CARD_COUNTS.plus2,
    AIR_HOTEL_SEASON_CARD_COUNTS.plus3,
  ]
}

function buildGeminiPrompt(monthKeys: [string, string, string], products: PoolProduct[]): string {
  const [m1, m2, m3] = monthKeys
  const seasonLine = formatMonthKeysForPrompt(monthKeys)
  const productLines = products
    .map((p) => `- ${p.id}: ${p.title}${p.country ? ` (${p.country})` : ''}`)
    .join('\n')

  return `${seasonLine} 자유여행 시즌 큐레이션을 다음 2단계로 수행하세요.

[1단계] 아래 상품 풀에서 각 월별로 갈만한 곳을 선정:
- ${monthLabelShort(m1)}월 ${AIR_HOTEL_SEASON_CARD_COUNTS.plus1}개 (초여름·가족여행지)
- ${monthLabelShort(m2)}월 ${AIR_HOTEL_SEASON_CARD_COUNTS.plus2}개 (여름방학·휴양·액티비티)
- ${monthLabelShort(m3)}월 ${AIR_HOTEL_SEASON_CARD_COUNTS.plus3}개 (한여름·시원한 곳 또는 휴양)
- 같은 상품은 한 월에만 (중복 금지)
- 풀 부족하면 가능한 만큼만

[2단계] 각 월별로 선정된 상품 기반으로 친근한 톤 1문장 멘트 작성.

[봉사장 톤 예시 — 반드시 참고]
- "6월의 가족여행지 우리가족만 오붓하게 보내는 다낭"
- "7월 여름방학의 시작 즐거운 추억만들기"
- "8월 여름은 어디나 더울까요? 홋카이도는 조금 서늘해요"

조건 (필수 준수):
- **한글 1문장만** (마침표·물음표·느낌표 1개만)
- **길이 30자 이내** (제목처럼 짧고 임팩트)
- 친근한 대화체 (질문형/감탄형 자연스럽게)
- 선정 상품 중 도시 1개 자연스럽게 언급
- 해당 월 시즌 맥락 반영

[좋은 예 길이 참고]
- "6월의 가족여행지 우리가족만 오붓하게 보내는 다낭" (24자)
- "7월 여름방학의 시작 즐거운 추억만들기" (19자)
- "8월 여름은 어디나 더울까요? 홋카이도는 조금 서늘해요" (26자)

[나쁜 예 — 절대 금지]
- 2문장 이상
- 50자 초과
- "~죠? ~까요?" 같은 2문장 조합

[상품 풀] (${products.length}개)
${productLines}

[출력 JSON]
{
  "${m1}": {
    "productIds": ["id1", "id2", "id3"],
    "message": "..."
  },
  "${m2}": {
    "productIds": ["id4", "id5", "id6"],
    "message": "..."
  },
  "${m3}": {
    "productIds": ["id7", "id8", "id9", "id10", "id11"],
    "message": "..."
  }
}`
}

function parseGeminiMonthlyCuration(
  text: string,
  monthKeys: [string, string, string],
): Record<string, MonthCuration> | null {
  const raw = stripLlmMarkdownJsonFence(text.trim())
  const objStr = extractFirstBalancedJsonObject(raw) ?? extractFirstBalancedJsonObject(text)
  if (!objStr) return null
  try {
    const parsed = JSON.parse(objStr) as Record<string, unknown>
    const out: Record<string, MonthCuration> = {}
    for (const mk of monthKeys) {
      const el = parsed[mk]
      if (!el || typeof el !== 'object' || Array.isArray(el)) return null
      const o = el as Record<string, unknown>
      const message = typeof o.message === 'string' ? o.message.trim() : ''
      if (!message) return null
      const productIds = Array.isArray(o.productIds)
        ? o.productIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : []
      out[mk] = { productIds, message }
    }
    return out
  } catch {
    return null
  }
}

function distributeProductIds(
  productIds: string[],
  monthKeys: [string, string, string],
): Record<string, string[]> {
  const [m1, m2, m3] = monthKeys
  const c1 = AIR_HOTEL_SEASON_CARD_COUNTS.plus1
  const c2 = AIR_HOTEL_SEASON_CARD_COUNTS.plus2
  return {
    [m1]: productIds.slice(0, c1),
    [m2]: productIds.slice(c1, c1 + c2),
    [m3]: productIds.slice(c1 + c2, c1 + c2 + AIR_HOTEL_SEASON_CARD_COUNTS.plus3),
  }
}

const SEASON_MESSAGE_MAX_LEN = 50

/** 월별 기본 fallback — 30자 이내 1문장 (봉사장 톤) */
const FALLBACK_PER_MONTH: Record<string, string> = {
  '1': '1월 새해, 따뜻한 여행지로 떠나요',
  '2': '2월 설 연휴, 가족과 함께 여행',
  '3': '3월 봄바람, 벚꽃과 함께 출발',
  '4': '4월 황금연휴, 봄 여행 어때요?',
  '5': '5월 어린이날, 가족여행 떠나요',
  '6': '6월, 가족과 떠나는 자유여행',
  '7': '7월 여름방학, 시원한 휴양지로',
  '8': '8월 무더위, 서늘한 곳으로',
  '9': '9월 추석 연휴, 힐링 여행',
  '10': '10월 단풍, 가을 여행 어떠세요?',
  '11': '11월 가을끝, 따뜻한 남쪽으로',
  '12': '12월 연말, 추억 만들 여행',
}

function buildFallbackPerMonth(monthKey: string): string {
  const monthNum = monthLabelShort(monthKey)
  return FALLBACK_PER_MONTH[monthNum] ?? `${monthNum}월, 즐거운 자유여행 떠나요`
}

function countSentenceMarkers(message: string): number {
  return (message.match(/[.!?]/g) || []).length
}

function sanitizeSeasonMessage(message: string, monthKey: string): string {
  const trimmed = message.trim()
  if (trimmed.length > SEASON_MESSAGE_MAX_LEN || countSentenceMarkers(trimmed) > 1) {
    return buildFallbackPerMonth(monthKey)
  }
  return trimmed
}

function buildFallbackMonthlyMessages(monthKeys: [string, string, string]): Record<string, string> {
  return Object.fromEntries(monthKeys.map((mk) => [mk, buildFallbackPerMonth(mk)]))
}

function buildCodeFallback(
  products: PoolProduct[],
  monthKeys: [string, string, string],
): { linkedProductIds: Record<string, string[]>; monthlyMessages: Record<string, string> } {
  const ids = products.map((p) => p.id)
  const linkedProductIds = distributeProductIds(ids, monthKeys)
  const monthlyMessages = buildFallbackMonthlyMessages(monthKeys)
  return { linkedProductIds, monthlyMessages }
}

function countsMatch(
  linkedProductIds: Record<string, string[]>,
  monthKeys: [string, string, string],
): boolean {
  const [m1, m2, m3] = monthKeys
  const [c1, c2, c3] = expectedCounts()
  return (
    (linkedProductIds[m1]?.length ?? 0) === c1 &&
    (linkedProductIds[m2]?.length ?? 0) === c2 &&
    (linkedProductIds[m3]?.length ?? 0) === c3
  )
}

/** LLM 응답 보정 — 풀 내 ID만, 중복 제거, 부족분 풀에서 채움 */
function correctMonthlyCuration(
  parsed: Record<string, MonthCuration>,
  monthKeys: [string, string, string],
  products: PoolProduct[],
): { linkedProductIds: Record<string, string[]>; monthlyMessages: Record<string, string> } | null {
  const poolOrder = products.map((p) => p.id)
  const poolSet = new Set(poolOrder)
  const used = new Set<string>()
  const [c1, c2, c3] = expectedCounts()
  const counts = [c1, c2, c3]
  const linkedProductIds: Record<string, string[]> = {}
  const monthlyMessages: Record<string, string> = {}

  for (let i = 0; i < monthKeys.length; i++) {
    const mk = monthKeys[i]
    const entry = parsed[mk]
    if (!entry?.message.trim()) return null

    const want = counts[i]
    const valid: string[] = []
    for (const id of entry.productIds) {
      if (!poolSet.has(id) || used.has(id)) continue
      valid.push(id)
      used.add(id)
      if (valid.length >= want) break
    }
    for (const id of poolOrder) {
      if (valid.length >= want) break
      if (used.has(id)) continue
      valid.push(id)
      used.add(id)
    }
    if (valid.length !== want) return null

    linkedProductIds[mk] = valid
    monthlyMessages[mk] = sanitizeSeasonMessage(entry.message, mk)
  }

  return { linkedProductIds, monthlyMessages }
}

async function generateMonthlyCuration(
  monthKeys: [string, string, string],
  products: PoolProduct[],
): Promise<{
  linkedProductIds: Record<string, string[]>
  monthlyMessages: Record<string, string>
  prompt: string
  response: unknown
  messageOk: boolean
}> {
  const prompt = buildGeminiPrompt(monthKeys, products)
  const codeFallback = buildCodeFallback(products, monthKeys)
  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!apiKey) {
    return {
      ...codeFallback,
      prompt,
      response: { error: 'GEMINI_KEY_MISSING', fallback: true },
      messageOk: false,
    }
  }

  try {
    const model = getGenAI().getGenerativeModel({ model: JOB_MODEL })
    const result = await model.generateContent(
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          ...( { responseMimeType: 'application/json' } as { responseMimeType?: string }),
        },
      },
      geminiTimeoutOpts(60_000),
    )
    const text = result.response.text()
    const finishReason = result.response.candidates?.[0]?.finishReason ?? null
    const parsed = parseGeminiMonthlyCuration(text, monthKeys)

    if (parsed) {
      const corrected = correctMonthlyCuration(parsed, monthKeys, products)
      if (corrected && countsMatch(corrected.linkedProductIds, monthKeys)) {
        return {
          ...corrected,
          prompt,
          response: { raw: text, finishReason, source: 'llm' },
          messageOk: true,
        }
      }
    }

    return {
      ...codeFallback,
      prompt,
      response: {
        fallback: true,
        raw: text,
        finishReason,
        parsed: parsed ?? null,
      },
      messageOk: false,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ...codeFallback,
      prompt,
      response: { error: msg, fallback: true },
      messageOk: false,
    }
  }
}

export async function runAirHotelSeasonCurationJob(
  input: { cycleId?: string } = {},
): Promise<AirHotelSeasonCurationJobResult> {
  const now = new Date()
  const cycleId = input.cycleId?.trim() || getAirHotelCycleIdForNow(now)
  const monthKeys = getAirHotelExposureMonthKeys(cycleId) as [string, string, string]
  const nowFloor = startOfTodayKst()

  const products = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      listingKind: 'air_hotel_free',
      travelScope: 'overseas',
      departures: { some: { departureDate: { gte: nowFloor } } },
      AND: [publicProductWhereClause(now)],
    },
    orderBy: { updatedAt: 'desc' },
    take: AIR_HOTEL_SEASON_POOL_SIZE,
    select: { id: true, title: true, country: true },
  })

  const [heroImageUrl, gemini] = await Promise.all([
    pickAirHotelSeasonHeroUrl(now),
    generateMonthlyCuration(monthKeys, products),
  ])

  const linkedCount = Object.values(gemini.linkedProductIds).reduce((n, ids) => n + ids.length, 0)

  await prisma.airHotelSeasonCuration.upsert({
    where: { cycleId },
    create: {
      cycleId,
      cycleStartDate: getAirHotelCycleStartDate(cycleId),
      monthlyMessages: gemini.monthlyMessages,
      heroImageUrl,
      linkedProductIds: gemini.linkedProductIds,
      geminiPrompt: gemini.prompt,
      geminiResponse: gemini.response as object,
      isPublished: true,
    },
    update: {
      cycleStartDate: getAirHotelCycleStartDate(cycleId),
      monthlyMessages: gemini.monthlyMessages,
      heroImageUrl,
      linkedProductIds: gemini.linkedProductIds,
      geminiPrompt: gemini.prompt,
      geminiResponse: gemini.response as object,
      isPublished: true,
    },
  })

  revalidateTag('air-hotel-season')
  revalidatePath('/travel/air-hotel')

  return {
    cycleId,
    ok: true,
    linkedCount,
    heroOk: Boolean(heroImageUrl),
    messageOk: gemini.messageOk,
  }
}
