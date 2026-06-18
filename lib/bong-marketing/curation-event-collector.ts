import { prisma } from '@/lib/prisma'
import { generateGeminiTextResponse } from '@/lib/bong-marketing/gemini-generate'
import { debugLog, debugError } from '@/lib/bong-marketing/debug-log'
import {
  listBongtourProductCountryLabels,
  parseGlobalEventsFromGeminiRaw,
  type CollectedEvent,
  type GlobalEventCollectError,
  type GlobalEventCollectResult,
} from '@/lib/bong-marketing/global-event-collector'

const CURATION_EVENT_MODEL = (process.env.CARD_NEWS_GEMINI_MODEL || 'gemini-2.5-pro').trim()
/** Gemini 출력 토큰 한계 회피 — 3개국씩 배치 (30개국 ≈ 10배치) */
export const CURATION_EVENT_COUNTRY_BATCH_SIZE = 3
const COUNTRY_BATCH_SIZE = CURATION_EVENT_COUNTRY_BATCH_SIZE
const CURATION_EVENT_MAX_OUTPUT_TOKENS = 16_384
const MAX_EVENTS_PER_COUNTRY = 8
const MAX_COUNTRIES_FOR_COLLECTION = 30

/** 한국인 인기 해외 목적지 — 배치 순서 우선 */
export const PRIORITY_COUNTRIES = [
  '일본',
  '중국',
  '대만',
  '태국',
  '베트남',
  '필리핀',
  '인도네시아',
  '말레이시아',
  '싱가포르',
  '홍콩',
  '마카오',
  '몽골',
  '미국',
  '캐나다',
  '호주',
  '뉴질랜드',
  '영국',
  '프랑스',
  '독일',
  '스페인',
  '이탈리아',
  '스위스',
  '터키',
  '두바이',
  '이집트',
] as const

function normalizeCountryLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

/** 핵심 국가 우선, 나머지는 한글 가나다순 */
export function sortCountriesByPriority(countries: string[], priority: readonly string[]): string[] {
  const priorityIndex = new Map(priority.map((c, i) => [normalizeCountryLabel(c), i]))
  const inPriority: string[] = []
  const rest: string[] = []

  for (const country of countries) {
    const key = normalizeCountryLabel(country)
    if (priorityIndex.has(key)) inPriority.push(country)
    else rest.push(country)
  }

  inPriority.sort(
    (a, b) =>
      (priorityIndex.get(normalizeCountryLabel(a)) ?? 999) -
      (priorityIndex.get(normalizeCountryLabel(b)) ?? 999),
  )
  rest.sort((a, b) => a.localeCompare(b, 'ko'))
  return [...inPriority, ...rest]
}

export async function getCurationEventTargetCountries(): Promise<string[]> {
  const labels = await listBongtourProductCountryLabels()
  return sortCountriesByPriority(labels, PRIORITY_COUNTRIES).slice(0, MAX_COUNTRIES_FOR_COLLECTION)
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

async function collectEventsForCountryBatch(
  countries: string[],
  year: number,
): Promise<{ events: CollectedEvent[]; rawPreview: string; partial: boolean; rawText: string }> {
  const countryList = countries.join(', ')

  const systemPrompt = `당신은 한국인 대상 해외여행 큐레이션 전문가입니다.

다음 국가들의 ${year}년 향후 3-12개월 내 열리는 **해외** 이벤트·축제만 수집하세요:
${countryList}

규칙:
- 한국인 여행객에게 어필할 수 있는 해외 이벤트만
- 한국 국내 축제·지역 행사는 절대 포함하지 마세요
- country 필드는 위 국가 목록의 한국어 국가명과 정확히 일치
- type: "festival" | "holiday" | "season" | "sale" | "special"
- **각 국가별 5~8개 이벤트** (최대 ${MAX_EVENTS_PER_COUNTRY}개, 그 이상 금지)
- description·appealReason은 각 1문장 이내로 간결하게
- **반드시 유효한 JSON 전체를 출력** — 마지막 이벤트 객체까지 닫고 최상위 \`}\` 까지 완성
- 토큰 한계가 임박해도 중간에 끊지 말고, 앞 국가 이벤트 수를 줄여 완전한 JSON으로 마무리

응답은 반드시 JSON만:
{
  "events": [
    {
      "name": "다낭 국제 불꽃축제",
      "country": "베트남",
      "city": "다낭",
      "startMonth": 6,
      "endMonth": 7,
      "type": "festival",
      "description": "해안 불꽃쇼",
      "appealReason": "여름 휴가 시즌 인기"
    }
  ]
}`.trim()

  const rawText = await generateGeminiTextResponse({
    model: CURATION_EVENT_MODEL,
    systemPrompt,
    userPrompt: `${year}년 ${countryList} 해외 이벤트 JSON (국가당 5~${MAX_EVENTS_PER_COUNTRY}개, 완전한 JSON 필수).`,
    temperature: 0.3,
    maxOutputTokens: CURATION_EVENT_MAX_OUTPUT_TOKENS,
    timeoutMs: 180_000,
  })

  const rawPreview = rawText.slice(0, 500)
  const { events, partial, parseError } = parseGlobalEventsFromGeminiRaw(rawText)

  if (partial && events.length) {
    debugLog(
      'curation-event',
      `배치 부분 파싱 salvage ${events.length}건 (${countryList})`,
      parseError ?? '',
    )
  } else if (!events.length && parseError) {
    throw new Error(`gemini_parse_failed: ${parseError}`)
  }

  return { events, rawPreview, partial, rawText }
}

async function upsertCollectedEvent(
  event: CollectedEvent,
  year: number,
): Promise<'created' | 'updated'> {
  const monthKey = `${year}-${String(event.startMonth).padStart(2, '0')}`

  const existing = await prisma.curationEvent.findUnique({
    where: {
      name_countryCode_year: {
        name: event.name,
        countryCode: event.country,
        year,
      },
    },
  })

  const shared = {
    monthKey,
    countryCode: event.country,
    city: event.city ?? null,
    startMonth: event.startMonth,
    startDay: event.startDay ?? null,
    endMonth: event.endMonth,
    endDay: event.endDay ?? null,
    type: event.type,
    description: event.description ?? null,
    appealReason: event.appealReason ?? null,
    source: 'gemini',
    marketingOnly: true,
    collectedAt: new Date(),
  }

  if (existing) {
    await prisma.curationEvent.update({
      where: { id: existing.id },
      data: shared,
    })
    return 'updated'
  }

  await prisma.curationEvent.create({
    data: {
      ...shared,
      name: event.name,
      year,
      status: 'draft',
    },
  })
  return 'created'
}

/** PR (가)-4: Product 국가 → Gemini(배치) → CurationEvent 저장 */
export async function refreshCurationEvents(): Promise<GlobalEventCollectResult> {
  const year = new Date().getFullYear()
  const result: GlobalEventCollectResult = {
    countries: [],
    collected: 0,
    saved: 0,
    skippedDuplicates: 0,
    errors: 0,
    errorDetails: [],
    rawResponseSamples: [],
    batchesRun: 0,
  }

  const countries = await getCurationEventTargetCountries()
  result.countries = countries

  if (!countries.length) {
    result.errorDetails.push({
      stage: 'no_countries',
      message: '등록 상품에서 국가를 찾지 못했습니다.',
    })
    result.errors = result.errorDetails.length
    debugLog('curation-event', '봉투어 Product 국가 없음')
    return result
  }

  const batches = chunkArray(countries, COUNTRY_BATCH_SIZE)
  debugLog(
    'curation-event',
    `${countries.length}개 국가(핵심 우선), ${batches.length}배치 수집 시작`,
  )

  for (const batch of batches) {
    result.batchesRun++
    const batchLabel = batch.join(', ')
    let rawText = ''

    try {
      const batchResult = await collectEventsForCountryBatch(batch, year)
      rawText = batchResult.rawText
      const { events, rawPreview, partial } = batchResult

      if (result.rawResponseSamples && result.rawResponseSamples.length < 3) {
        result.rawResponseSamples.push(`[${batchLabel}]${partial ? ' (partial)' : ''} ${rawPreview}`)
      }

      if (!events.length) {
        result.errorDetails.push({
          stage: 'json_parse',
          message: 'Gemini 응답에서 유효한 이벤트 0개 (파싱 결과 빈 배열)',
          country: batchLabel,
        })
        debugError('curation-event', `배치 파싱 0건: ${batchLabel}`, rawPreview)
        continue
      }

      for (const event of events) {
        try {
          const outcome = await upsertCollectedEvent(event, year)
          result.collected++
          if (outcome === 'created') result.saved++
          else result.skippedDuplicates++
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          result.errorDetails.push({
            stage: 'db_upsert',
            message: `${event.name}: ${message}`,
            country: event.country,
          })
          debugError('curation-event', `이벤트 저장 실패 (${event.name}):`, err)
        }
      }

      debugLog(
        'curation-event',
        `배치 저장 ${events.length}건${partial ? ' (부분 salvage)' : ''}: ${batchLabel}`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)

      if (rawText) {
        const salvaged = parseGlobalEventsFromGeminiRaw(rawText)
        if (salvaged.events.length) {
          if (result.rawResponseSamples && result.rawResponseSamples.length < 3) {
            result.rawResponseSamples.push(
              `[${batchLabel}] (partial-after-error) ${rawText.slice(0, 500)}`,
            )
          }
          for (const event of salvaged.events) {
            try {
              const outcome = await upsertCollectedEvent(event, year)
              result.collected++
              if (outcome === 'created') result.saved++
              else result.skippedDuplicates++
            } catch (saveErr) {
              const saveMsg = saveErr instanceof Error ? saveErr.message : String(saveErr)
              result.errorDetails.push({
                stage: 'db_upsert',
                message: `${event.name}: ${saveMsg}`,
                country: event.country,
              })
            }
          }
          debugLog(
            'curation-event',
            `에러 후 salvage ${salvaged.events.length}건 저장: ${batchLabel}`,
          )
          continue
        }
      }

      result.errorDetails.push({
        stage: 'gemini_api',
        message,
        country: batchLabel,
      })
      debugError('curation-event', `배치 Gemini 실패 (${batchLabel}):`, err)
    }
  }

  if (result.collected === 0 && !result.errorDetails.some((e) => e.stage === 'empty_response')) {
    result.errorDetails.push({
      stage: 'empty_response',
      message:
        '전체 배치에서 이벤트 0개 — Gemini API 실패·JSON 파싱 실패·응답 토큰 초과 가능성. errorDetails 참고.',
    } as GlobalEventCollectError)
  }

  result.errors = result.errorDetails.length
  debugLog('curation-event', '완료:', result)
  return result
}
