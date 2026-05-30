/**
 * /travel/air-hotel 시즌 큐레이션 — Gemini job + DB upsert (25일 cron 2단계에서 호출).
 */
import { prisma } from '@/lib/prisma'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { extractFirstBalancedJsonObject, stripLlmMarkdownJsonFence } from '@/lib/llm-json-extract'
import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import { pickAirHotelSeasonHeroUrl } from '@/lib/air-hotel-hero-image-pick'
import {
  AIR_HOTEL_SEASON_CARD_COUNTS,
  AIR_HOTEL_SEASON_TOTAL_CARDS,
  getAirHotelCycleIdForNow,
  getAirHotelCycleStartDate,
  getAirHotelExposureMonthKeys,
} from '@/lib/air-hotel-season-curation-constants'

const JOB_MODEL = process.env.GEMINI_AIR_HOTEL_SEASON_MODEL?.trim() || getModelName()

export type AirHotelSeasonCurationJobResult = {
  cycleId: string
  ok: true
  linkedCount: number
  heroOk: boolean
  messageOk: boolean
}

function startOfTodayKst(): Date {
  const seoul = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  seoul.setHours(0, 0, 0, 0)
  return seoul
}

function formatMonthKeysForPrompt(monthKeys: string[]): string {
  return monthKeys
    .map((k) => {
      const m = parseInt(k.split('-')[1] ?? '0', 10)
      return `${k.split('-')[0]}년 ${m}월`
    })
    .join('·')
}

function buildFallbackSeasonMessage(monthKeys: string[]): string {
  const label = formatMonthKeysForPrompt(monthKeys)
  return `${label} 가족과 함께 떠나는 해외 자유여행 시즌입니다.`
}

function buildGeminiPrompt(
  monthKeys: string[],
  products: { title: string; country: string | null }[],
): string {
  const monthLine = formatMonthKeysForPrompt(monthKeys)
  const productLines = products
    .map((p) => `- ${p.title}${p.country ? ` (${p.country})` : ''}`)
    .join('\n')
  return `${monthLine} 가족과 함께 떠나는 해외 자유여행 시즌입니다.
현재 인기 자유여행 상품 ${products.length}개:
${productLines}

위 상품들을 아우르는 1~2문장 시즌 멘트를 한글로 작성하세요.
조건: 가족여행·자유여행 분위기, 다음 3개월 시즌감, 따뜻한 톤.
출력은 JSON {"message": "..."} 형식.`
}

function parseGeminiMessage(text: string): string | null {
  const raw = stripLlmMarkdownJsonFence(text.trim())
  const objStr = extractFirstBalancedJsonObject(raw) ?? extractFirstBalancedJsonObject(text)
  if (!objStr) return null
  try {
    const parsed = JSON.parse(objStr) as { message?: unknown }
    const msg = typeof parsed.message === 'string' ? parsed.message.trim() : ''
    return msg || null
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

async function generateSeasonMessage(
  monthKeys: string[],
  products: { title: string; country: string | null }[],
): Promise<{ message: string; prompt: string; response: unknown; messageOk: boolean }> {
  const prompt = buildGeminiPrompt(monthKeys, products)
  const fallback = buildFallbackSeasonMessage(monthKeys)
  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!apiKey) {
    return { message: fallback, prompt, response: { error: 'GEMINI_KEY_MISSING' }, messageOk: false }
  }

  try {
    const model = getGenAI().getGenerativeModel({ model: JOB_MODEL })
    const result = await model.generateContent(
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 512,
          ...( { responseMimeType: 'application/json' } as { responseMimeType?: string }),
        },
      },
      geminiTimeoutOpts(60_000),
    )
    const text = result.response.text()
    const parsed = parseGeminiMessage(text)
    return {
      message: parsed ?? fallback,
      prompt,
      response: parsed ? { message: parsed, raw: text } : { fallback, raw: text },
      messageOk: Boolean(parsed),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      message: fallback,
      prompt,
      response: { error: msg },
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
    take: AIR_HOTEL_SEASON_TOTAL_CARDS,
    select: { id: true, title: true, country: true },
  })

  const linkedProductIds = distributeProductIds(
    products.map((p) => p.id),
    monthKeys,
  )
  const linkedCount = products.length

  const [heroImageUrl, gemini] = await Promise.all([
    pickAirHotelSeasonHeroUrl(now),
    generateSeasonMessage(monthKeys, products),
  ])

  await prisma.airHotelSeasonCuration.upsert({
    where: { cycleId },
    create: {
      cycleId,
      cycleStartDate: getAirHotelCycleStartDate(cycleId),
      seasonMessage: gemini.message,
      heroImageUrl,
      linkedProductIds,
      geminiPrompt: gemini.prompt,
      geminiResponse: gemini.response as object,
      isPublished: true,
    },
    update: {
      cycleStartDate: getAirHotelCycleStartDate(cycleId),
      seasonMessage: gemini.message,
      heroImageUrl,
      linkedProductIds,
      geminiPrompt: gemini.prompt,
      geminiResponse: gemini.response as object,
      isPublished: true,
    },
  })

  return {
    cycleId,
    ok: true,
    linkedCount,
    heroOk: Boolean(heroImageUrl),
    messageOk: gemini.messageOk,
  }
}
