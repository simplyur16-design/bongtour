/**
 * FitItineraryMaster 일괄 생성 (Gemini v3 JSON 패턴).
 *
 * 실행:
 *   pnpm tsx scripts/generate-fit-itinerary-masters.ts --productId=cmnwmunpq02vjkvo6hqzx7m6v
 *   pnpm tsx scripts/generate-fit-itinerary-masters.ts
 *   pnpm tsx scripts/generate-fit-itinerary-masters.ts --skip-existing
 *   pnpm tsx scripts/generate-fit-itinerary-masters.ts --mode=package
 *   pnpm tsx scripts/generate-fit-itinerary-masters.ts --mode=package --skip-existing
 */
import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { loadEnvForScripts } from './load-env-for-scripts'
import {
  getGenAI,
  getModelName,
  geminiTimeoutOpts,
  testGeminiConnection,
  GEMINI_MODEL,
} from '@/lib/gemini-client'
import { extractFirstBalancedJsonObject, stripLlmMarkdownJsonFence } from '@/lib/llm-json-extract'
import { generateFitItineraryForProduct } from '@/lib/fit-itinerary-generate-for-product'

loadEnvForScripts()

const MODE: 'airtel' | 'package' =
  process.argv.find((a) => a.startsWith('--mode='))?.split('=')[1] === 'package'
    ? 'package'
    : 'airtel'

const prisma = new PrismaClient()

const MODEL = (process.env.GEMINI_MODEL?.trim() || GEMINI_MODEL || 'gemini-3-flash-preview')

const VALID_PERSONAS = new Set(['mixed', 'couple', 'with-parents', 'with-kids'])
const VALID_CATEGORIES = new Set(['transport', 'hotel', 'meal', 'attraction', 'shopping'])

function cuid(): string {
  return 'c' + Date.now().toString(36) + randomBytes(8).toString('hex')
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
        maxOutputTokens: opts.maxOutputTokens ?? 8000,
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

function buildPackagePrompt(p: PromptProduct): string {
  const scheduleJson =
    typeof p.schedule === 'string' ? p.schedule : JSON.stringify(p.schedule ?? [])
  return `당신은 봉투어의 패키지 여행 큐레이터입니다. 스크래퍼가 박은 일정을 base로 활동을 분리·풍부화합니다.

[상품 정보]
- 제목: ${p.title}
- 도시: ${p.cityNameKo} (cityKey: ${p.cityKey}, 국가: ${p.countryCode})
- 일정: ${p.duration} (총 ${p.totalDays}일)
- 항공사: ${p.airline ?? '미지정'}
- 호텔: ${p.hotelSummaryText ?? '여행사 박힌 호텔'}
- 기존 스케줄 (스크래퍼 박힌 base):
${scheduleJson.substring(0, 4000)}

[작성 규칙 — 가오슝 v3 패턴 동일]
- 기존 schedule[day]의 description을 활동 카드 단위로 분리
- 활동 카테고리 5: transport(공항·이동), hotel(체크인·체크아웃), meal(아침·점심·저녁·현지식), attraction(관광), shopping(쇼핑)
- description 안 박힌 장소·식사·이동 내용을 활동 카드로 분리. 3~6개/day
- 식사 정보 = breakfastText/lunchText/dinnerText 박혀있으면 활용. 없으면 "현지식"/"호텔식"/"기내식" 추정
- hotelText 박혀있으면 hotel 활동에 박기
- 각 활동 = 짧고 풍부한 한 문장 설명. 가오슝 톤
- startTime 자동 추정 (09:00~21:00 사이, 활동 간 1~2시간 간격)
- persona 자동 분석 (가족/연인/부모/혼합)
- 도시명·시간이 다르면 정확하게 박기

[출력] 가오슝 v3 JSON 패턴 그대로:
{ "title": "...", "summary": "...", "persona": "mixed|couple|with-parents|with-kids", "days": [{ "dayNumber": 1, "title": "...", "summary": "...", "dayCityKey": "${p.cityKey}", "activities": [...] }] }`
}

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

/** 자유여행 26개 (가오승 cmnwlxxah01itkvo6jr6dv2y8 제외). 고베 ID 중복 제거 — 확인 후 추가. */
const TARGETS_RAW = [
  'cmnwmunpq02vjkvo6hqzx7m6v',
  'cmnwlheca009gkvo6e4euyn78',
  'cmnwlr2z000umkvo6w1tw4499',
  'cmnwlthdh010ikvo62yb0ah9d',
  'cmoplef6x00099hhf0ty0znwu',
  'cmnwmclw602lskvo6k169im5t',
  'cmnwlwa9u018bkvo6xe62hkuj',
  'cmp8fdpml001h3t9ys7f02jv3',
  'cmnsh6qrc0008lb3kpuoi9qhk',
  'cmnrkne9w000z4dmyv7iivoju',
  'cmnwm2r8301v4kvo6roron364',
  'cmnwm0fxv01o1kvo6vfuhxw5b',
  'cmnx5mr8j0006ifirxvpt5djk',
  'cmnwn9myi02xukvo6e7yuo0hb',
  'cmnxx0oif00061boptd9xp0mc',
  'cmny0in320006dkrmgkcjxf00',
  'cmnxx5kur000s1boptcpchqkt',
  'cmnx7d0cj001nifiry22xb6b6',
  'cmnwm8rsn024mkvo62q1ycxdp',
  'cmnwni4jw02z3kvo61hi6tw4s',
  'cmnshozbt00h1lb3ks6xuwvvr',
  'cmnwmatup02f3kvo6456la240',
  'cmnx4zckr00y7phc9yhja5jni',
  'cmnwm6w6t0241kvo6q3wc81ww',
  'cmnx4i7wu00uyphc9wi7yrlza',
]

async function generateOneAirtelMaster(productId: string, skipExisting: boolean) {
  console.log(`[start] ${productId}`)
  if (!skipExisting) {
    const existing = await prisma.fitItineraryMaster.findUnique({
      where: { productId },
      select: { id: true },
    })
    if (existing) {
      await prisma.fitItineraryMaster.delete({ where: { productId } })
      console.log(`[replace] ${productId} — 기존 master 삭제`)
    }
  }

  const result = await generateFitItineraryForProduct(productId)
  if (result.success) {
    console.log(`[done] ${productId} — master=${result.masterId}`)
    return
  }
  if (result.reason === 'already_exists') {
    console.log(`[skip] ${productId} — 기존 master=${result.masterId}`)
    return
  }
  throw new Error(
    `${productId}: ${result.reason ?? 'unknown'}${result.error instanceof Error ? ` — ${result.error.message}` : ''}`,
  )
}

async function generateOnePackageMaster(productId: string, skipExisting: boolean) {
  console.log(`[start] ${productId}`)
  const existing = await prisma.fitItineraryMaster.findUnique({
    where: { productId },
    select: { id: true, status: true },
  })
  if (existing && skipExisting) {
    console.log(`[skip] ${productId} — 기존 master=${existing.id} (${existing.status})`)
    return
  }
  if (existing) {
    await prisma.fitItineraryMaster.delete({ where: { productId } })
    console.log(`[replace] ${productId} — 기존 master 삭제`)
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
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
  if (!product) throw new Error(`Product not found: ${productId}`)

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
  const prompt = buildPackagePrompt(promptInput)

  const responseText = await generateGeminiText({
    model: MODEL,
    prompt,
    temperature: 0.7,
    maxOutputTokens: 8000,
  })

  const parsed = parseGeminiJson(responseText)
  const masterId = cuid()

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

  const activityCount = parsed.days.reduce((s, d) => s + (d.activities?.length ?? 0), 0)
  console.log(
    `[done] ${productId} — master=${masterId}, days=${parsed.days.length}, activities=${activityCount}`,
  )
}

async function main() {
  const argProduct = process.argv.find((a) => a.startsWith('--productId='))
  const skipExisting = process.argv.includes('--skip-existing')

  let targets: string[]
  if (argProduct) {
    targets = [argProduct.split('=')[1]!]
  } else if (MODE === 'package') {
    const products = await prisma.product.findMany({
      where: {
        productType: { in: ['travel', 'private', 'semi'] },
        registrationStatus: 'registered',
      },
      select: { id: true },
    })
    targets = products.map((p) => p.id)
    console.log(`Package mode: ${targets.length} products`)
  } else {
    targets = [...new Set(TARGETS_RAW)]
  }

  const conn = await testGeminiConnection()
  if (!conn.ok) {
    throw new Error(`Gemini 연결 실패: ${conn.error ?? 'unknown'}`)
  }
  console.log(`Gemini model: ${conn.model}`)
  console.log(`Mode: ${MODE}, Targets: ${targets.length}`)
  console.log(`Generating ${targets.length} masters (skip-existing=${skipExisting})…`)

  let success = 0
  let fail = 0
  for (const id of targets) {
    try {
      if (MODE === 'package') {
        await generateOnePackageMaster(id, skipExisting)
      } else {
        await generateOneAirtelMaster(id, skipExisting)
      }
      success++
    } catch (err) {
      console.error(`[fail] ${id}:`, err)
      fail++
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  console.log(`\nDone. success=${success}, fail=${fail}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
