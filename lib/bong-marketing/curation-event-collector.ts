import { prisma } from '@/lib/prisma'
import { generateGeminiTextResponse } from '@/lib/bong-marketing/gemini-generate'
import { debugLog, debugError } from '@/lib/bong-marketing/debug-log'
import { monthOverlapsEvent } from '@/lib/bong-marketing/curation-event-repository'
import {
  listBongtourProductCountryLabels,
  parseGlobalEventsFromGeminiRaw,
  type CollectedEvent,
  type GlobalEventCollectError,
  type GlobalEventCollectResult,
} from '@/lib/bong-marketing/global-event-collector'
import {
  type CurationEventRefreshOptions,
  resolveCurationEventTargetCountries,
} from '@/lib/bong-marketing/curation-event-target-countries'

export type { CurationEventRefreshOptions, CurationEventTargetMode } from '@/lib/bong-marketing/curation-event-target-countries'
export { getCurationCountries, resolveCurationEventTargetCountries } from '@/lib/bong-marketing/curation-event-target-countries'

const CURATION_EVENT_MODEL = (process.env.CARD_NEWS_GEMINI_MODEL || 'gemini-2.5-pro').trim()
/** Gemini 출력 토큰 한계 회피 — 일반 국가 3개국씩 배치 */
export const CURATION_EVENT_COUNTRY_BATCH_SIZE = 3
const COUNTRY_BATCH_SIZE = CURATION_EVENT_COUNTRY_BATCH_SIZE
const CURATION_EVENT_MAX_OUTPUT_TOKENS = 16_384
const MAX_EVENTS_PER_COUNTRY = 8
const MIN_EVENTS_PER_COUNTRY = 8
const MIN_MONTHS_COVERED_PER_COUNTRY = 8
/** 비수기·누락 다발 월 — 커버리지 검사 강조 */
const CRITICAL_COVERAGE_MONTHS = [1, 2, 8] as const
const MAX_COUNTRIES_FOR_COLLECTION = 30

/** 한국인 인기 해외 목적지 — 단독 정밀 호출 + 배치 순서 우선 */
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

export interface CurationEventCollectResult extends GlobalEventCollectResult {
  /** 운영자 검토 안내 */
  reviewNotice?: string
  /** approved 기존 row 스킵 (덮어쓰기 방지) */
  skippedApproved?: number
  /** 핵심 국가 단독 호출 수 */
  priorityCallsRun?: number
  /** PR (가)-6 — 갱신 대상 모드 */
  targetMode?: import('@/lib/bong-marketing/curation-event-target-countries').CurationEventTargetMode
  /** curation 모드에서 Product 국가로 대체된 경우 */
  usedProductFallback?: boolean
}

export interface MonthCoverageGap {
  country: string
  coveredMonths: number[]
  missingMonths: number[]
  missingCriticalMonths: number[]
}

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
  const { countries } = await resolveCurationEventTargetCountries({ targetMode: 'all_products' })
  return countries
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function isPriorityCountry(country: string): boolean {
  const key = normalizeCountryLabel(country)
  return PRIORITY_COUNTRIES.some((c) => normalizeCountryLabel(c) === key)
}

/** 핵심 국가 단독 + 일반 국가 3개국 배치 실행 계획 */
export function buildCurationEventBatchPlan(countries: string[]): Array<{
  countries: string[]
  mode: 'priority_single' | 'batch'
}> {
  const priorityInTarget = countries.filter(isPriorityCountry)
  const nonPriority = countries.filter((c) => !isPriorityCountry(c))

  const plan: Array<{ countries: string[]; mode: 'priority_single' | 'batch' }> = []
  for (const country of priorityInTarget) {
    plan.push({ countries: [country], mode: 'priority_single' })
  }
  for (const batch of chunkArray(nonPriority, COUNTRY_BATCH_SIZE)) {
    plan.push({ countries: batch, mode: 'batch' })
  }
  return plan
}

function eventCoversMonth(event: CollectedEvent, month: number): boolean {
  return monthOverlapsEvent(month, event.startMonth, event.endMonth)
}

function findCountryEvents(events: CollectedEvent[], country: string): CollectedEvent[] {
  return events.filter((e) => normalizeCountryLabel(e.country) === normalizeCountryLabel(country))
}

/** 국가별 1-12월 커버리지 갭 분석 */
export function analyzeMonthCoverageGaps(
  events: CollectedEvent[],
  expectedCountries: string[],
): MonthCoverageGap[] {
  const gaps: MonthCoverageGap[] = []

  for (const country of expectedCountries) {
    const countryEvents = findCountryEvents(events, country)
    const coveredMonths = Array.from({ length: 12 }, (_, i) => i + 1).filter((month) =>
      countryEvents.some((e) => eventCoversMonth(e, month)),
    )
    const missingMonths = Array.from({ length: 12 }, (_, i) => i + 1).filter(
      (month) => !coveredMonths.includes(month),
    )
    const missingCriticalMonths = CRITICAL_COVERAGE_MONTHS.filter((m) =>
      missingMonths.includes(m),
    )

    gaps.push({
      country,
      coveredMonths,
      missingMonths,
      missingCriticalMonths,
    })
  }

  return gaps
}

export function formatMonthCoverageGapMessage(gap: MonthCoverageGap): string {
  const parts: string[] = []
  if (gap.missingCriticalMonths.length) {
    parts.push(`핵심 누락 월 ${gap.missingCriticalMonths.join(',')}월`)
  }
  if (gap.coveredMonths.length < MIN_MONTHS_COVERED_PER_COUNTRY) {
    parts.push(
      `월 커버 ${gap.coveredMonths.length}/${MIN_MONTHS_COVERED_PER_COUNTRY} (누락: ${gap.missingMonths.join(',')}월)`,
    )
  }
  return parts.join(' · ')
}

/** parseGlobalEventsFromGeminiRaw + 월·국가 누락 분석 */
export function parseEventsWithFallback(
  rawText: string,
  expectedCountries: string[],
): {
  events: CollectedEvent[]
  partial: boolean
  parseError?: string
  coverageGaps: MonthCoverageGap[]
} {
  const parsed = parseGlobalEventsFromGeminiRaw(rawText)
  const coverageGaps = analyzeMonthCoverageGaps(parsed.events, expectedCountries)
  return { ...parsed, coverageGaps }
}

/** PR (가)-4.6 — 이벤트명 fuzzy match용 정규화 */
export function normalizeEventName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .replace(/페스티벌$/i, '축제')
    .replace(/마쯔리/g, '마츠리')
    .trim()
}

function eventMonthRangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  for (let month = 1; month <= 12; month++) {
    if (
      monthOverlapsEvent(month, aStart, aEnd) &&
      monthOverlapsEvent(month, bStart, bEnd)
    ) {
      return true
    }
  }
  return false
}

/** 정규화 후 동일·포함·토큰 겹침으로 같은 이벤트 판별 */
export function normalizedEventNamesMatch(a: string, b: string): boolean {
  const na = normalizeEventName(a).toLowerCase()
  const nb = normalizeEventName(b).toLowerCase()
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true

  const tokensA = na.split(' ').filter((t) => t.length > 1)
  const tokensB = nb.split(' ').filter((t) => t.length > 1)
  const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB
  const longer = tokensA.length > tokensB.length ? tokensA : tokensB
  if (shorter.length < 2) return false
  const overlap = shorter.filter((t) =>
    longer.some((l) => l.includes(t) || t.includes(l)),
  ).length
  return overlap / shorter.length >= 0.6
}

function buildEventNameFormatRules(): string {
  return `
이벤트 이름(name) 표기 규칙 (중복 방지 — **한 이벤트당 표기 1가지만**):
- 한국에서 가장 일반적으로 쓰는 **공식 한국어 표기 1가지**만 사용
- 도시명을 이름 앞에 붙이지 마세요 (X "뮌헨 옥토버페스트" → O "옥토버페스트")
- 괄호 안 영문 원어 병기 금지 (X "옥토버페스트 (Oktoberfest)" → O "옥토버페스트")
- 축제/페스티벌 표기 통일 — 한국어 **축제** 우선 (고유명사 "재즈 페스티벌" 등은 예외)
- 마쯔리/마츠리 → **마츠리**로 통일 (한국 표준 외래어 표기법)
- 이름 끝에 불필요한 " 축제" 중복 금지 (X "단오절 용선 축제" → O "단오절")
- 같은 이벤트를 여러 변형으로 쓰지 마세요

부정 예시 (같은 이벤트 변형 — 금지):
- X "퀸스타운 윈터 페스티벌" + "퀸스타운 겨울 축제"
- X "타이베이 101 신년 불꽃놀이" + "신년 불꽃축제" + "신년 맞이 불꽃놀이"
- O 위 예시는 **한 가지 표기**로만 출력`.trim()
}

function buildPrioritySingleCountryPrompt(country: string, year: number): string {
  return `당신은 한국인 대상 해외여행 큐레이션 전문가입니다.

**${country}** 단일 국가의 ${year}년 해외 이벤트·축제를 **12개월 골고루** 수집하세요.

필수 규칙:
- **1~12월 모든 월에 골고루 분포** — 여름·겨울 비수기(1·2·8월 등)에도 한국인이 가볼 만한 이벤트 **반드시** 포함
- **최소 ${MIN_EVENTS_PER_COUNTRY}개 이벤트**, **12개월 중 ${MIN_MONTHS_COVERED_PER_COUNTRY}개월 이상** 커버
- country 필드는 "${country}" 와 정확히 일치 (한국어)
- type: "festival" | "holiday" | "season" | "sale" | "special"
- description·appealReason 각 1문장 이내
- **반드시 유효한 JSON 전체 출력** — 마지막 객체까지 닫고 \`}\` 완성

${buildEventNameFormatRules()}

월별 예시 (일본이면 참고):
- 1월: 신년·삿포로 눈축제
- 2월: 홋카이도 눈축제·요코하마 딸기
- 8월: 오봉·여름 마츠리·불꽃대회

응답 JSON만:
{
  "events": [
    {
      "name": "이벤트명",
      "country": "${country}",
      "city": "도시",
      "startMonth": 1,
      "endMonth": 2,
      "type": "festival",
      "description": "한 줄",
      "appealReason": "한 줄"
    }
  ]
}`.trim()
}

function buildBatchCountriesPrompt(countries: string[], year: number): string {
  const countryList = countries.join(', ')

  return `당신은 한국인 대상 해외여행 큐레이션 전문가입니다.

다음 국가들의 ${year}년 **해외** 이벤트·축제를 수집하세요:
${countryList}

규칙:
- **각 국가마다 1~12월 골고루 분포** — 비수기(1·2·8월)에도 한국인 인기 이벤트 포함
- 국가당 **${MIN_EVENTS_PER_COUNTRY}개** (최대 ${MAX_EVENTS_PER_COUNTRY}개), **8개월 이상** 커버
- country 필드는 위 한국어 국가명과 정확히 일치
- type: "festival" | "holiday" | "season" | "sale" | "special"
- description·appealReason 각 1문장 이내
- **반드시 유효한 JSON 전체 출력**
- 토큰 한계 임박 시 국가 수를 줄이지 말고 이벤트 수를 줄여 완전한 JSON으로 마무리

${buildEventNameFormatRules()}

응답 JSON만:
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
}

async function collectEventsForCountryBatch(
  countries: string[],
  year: number,
  mode: 'priority_single' | 'batch',
): Promise<{ events: CollectedEvent[]; rawPreview: string; partial: boolean; rawText: string; coverageGaps: MonthCoverageGap[] }> {
  const countryList = countries.join(', ')
  const systemPrompt =
    mode === 'priority_single'
      ? buildPrioritySingleCountryPrompt(countries[0], year)
      : buildBatchCountriesPrompt(countries, year)

  const userPrompt =
    mode === 'priority_single'
      ? `${year}년 ${countries[0]} 12개월 분포 이벤트 JSON (최소 ${MIN_EVENTS_PER_COUNTRY}개, 1·2·8월 포함, 완전한 JSON 필수).`
      : `${year}년 ${countryList} 해외 이벤트 JSON (국가당 ${MIN_EVENTS_PER_COUNTRY}개·8개월 이상 커버, 완전한 JSON 필수).`

  const rawText = await generateGeminiTextResponse({
    model: CURATION_EVENT_MODEL,
    systemPrompt,
    userPrompt,
    temperature: 0.3,
    maxOutputTokens: CURATION_EVENT_MAX_OUTPUT_TOKENS,
    timeoutMs: 180_000,
  })

  const rawPreview = rawText.slice(0, 500)
  const { events, partial, parseError, coverageGaps } = parseEventsWithFallback(rawText, countries)

  if (partial && events.length) {
    debugLog(
      'curation-event',
      `배치 부분 파싱 salvage ${events.length}건 (${countryList})`,
      parseError ?? '',
    )
  } else if (!events.length && parseError) {
    throw new Error(`gemini_parse_failed: ${parseError}`)
  }

  return { events, rawPreview, partial, rawText, coverageGaps }
}

function appendCoverageGapErrors(
  errorDetails: GlobalEventCollectError[],
  gaps: MonthCoverageGap[],
  partial: boolean,
): void {
  for (const gap of gaps) {
    const msg = formatMonthCoverageGapMessage(gap)
    if (!msg) continue
    errorDetails.push({
      stage: 'json_parse',
      message: partial ? `부분 파싱 후 ${msg}` : `월 분포 부족: ${msg}`,
      country: gap.country,
    })
  }
}

export async function findSimilarEvent(
  event: CollectedEvent,
  year: number,
): Promise<{ id: string; status: string } | null> {
  const exact = await prisma.curationEvent.findUnique({
    where: {
      name_countryCode_year: {
        name: event.name,
        countryCode: event.country,
        year,
      },
    },
    select: { id: true, status: true },
  })
  if (exact) return exact

  if (event.city?.trim()) {
    const bySlot = await prisma.curationEvent.findFirst({
      where: {
        countryCode: event.country,
        year,
        city: event.city.trim(),
        startMonth: event.startMonth,
        endMonth: event.endMonth,
        type: event.type,
      },
      select: { id: true, status: true },
    })
    if (bySlot) return bySlot
  }

  const candidates = await prisma.curationEvent.findMany({
    where: { countryCode: event.country, year },
    select: {
      id: true,
      name: true,
      status: true,
      startMonth: true,
      endMonth: true,
      type: true,
    },
  })

  for (const row of candidates) {
    if (row.type !== event.type) continue
    if (
      !eventMonthRangesOverlap(
        event.startMonth,
        event.endMonth,
        row.startMonth,
        row.endMonth,
      )
    ) {
      continue
    }
    if (normalizedEventNamesMatch(event.name, row.name)) {
      return row
    }
  }

  return null
}

async function upsertCollectedEvent(
  event: CollectedEvent,
  year: number,
): Promise<'created' | 'updated' | 'skipped_approved'> {
  const monthKey = `${year}-${String(event.startMonth).padStart(2, '0')}`

  const existing = await findSimilarEvent(event, year)

  if (existing?.status === 'approved') {
    return 'skipped_approved'
  }

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

async function saveBatchEvents(
  events: CollectedEvent[],
  year: number,
  result: CurationEventCollectResult,
): Promise<void> {
  for (const event of events) {
    try {
      const outcome = await upsertCollectedEvent(event, year)
      result.collected++
      if (outcome === 'created') result.saved++
      else if (outcome === 'updated') result.skippedDuplicates++
      else if (outcome === 'skipped_approved') {
        result.skippedApproved = (result.skippedApproved ?? 0) + 1
      }
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
}

/** PR (가)-4: Product 국가 → Gemini(배치) → CurationEvent 저장 */
export async function refreshCurationEvents(
  options?: CurationEventRefreshOptions,
): Promise<CurationEventCollectResult> {
  const year = new Date().getFullYear()
  const result: CurationEventCollectResult = {
    countries: [],
    collected: 0,
    saved: 0,
    skippedDuplicates: 0,
    skippedApproved: 0,
    errors: 0,
    errorDetails: [],
    rawResponseSamples: [],
    batchesRun: 0,
    priorityCallsRun: 0,
  }

  const resolved = await resolveCurationEventTargetCountries(options)
  result.targetMode = resolved.targetMode
  result.usedProductFallback = resolved.usedProductFallback

  if (resolved.targetMode === 'recommendation' && !resolved.countries.length) {
    result.errorDetails.push({
      stage: 'no_countries',
      message:
        '추천 국가가 없습니다. 먼저 [추천 받기]를 실행하거나 targetCountries를 전달해 주세요.',
    })
    result.errors = result.errorDetails.length
    debugLog('curation-event', '추천 국가 없음 — 갱신 스킵')
    return result
  }

  const countries = resolved.countries
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

  const batchPlan = buildCurationEventBatchPlan(countries)
  debugLog(
    'curation-event',
    `${countries.length}개 국가, 핵심 단독 ${batchPlan.filter((b) => b.mode === 'priority_single').length}회 + 일반 배치 ${batchPlan.filter((b) => b.mode === 'batch').length}회`,
  )

  for (const { countries: batch, mode } of batchPlan) {
    result.batchesRun++
    if (mode === 'priority_single') result.priorityCallsRun = (result.priorityCallsRun ?? 0) + 1

    const batchLabel = batch.join(', ')
    let rawText = ''

    try {
      const batchResult = await collectEventsForCountryBatch(batch, year, mode)
      rawText = batchResult.rawText
      const { events, rawPreview, partial, coverageGaps } = batchResult

      if (result.rawResponseSamples && result.rawResponseSamples.length < 3) {
        result.rawResponseSamples.push(
          `[${mode === 'priority_single' ? '핵심' : '배치'}:${batchLabel}]${partial ? ' (partial)' : ''} ${rawPreview}`,
        )
      }

      appendCoverageGapErrors(result.errorDetails, coverageGaps, partial)

      if (!events.length) {
        result.errorDetails.push({
          stage: 'json_parse',
          message: 'Gemini 응답에서 유효한 이벤트 0개 (파싱 결과 빈 배열)',
          country: batchLabel,
        })
        debugError('curation-event', `배치 파싱 0건: ${batchLabel}`, rawPreview)
        continue
      }

      await saveBatchEvents(events, year, result)

      debugLog(
        'curation-event',
        `${mode === 'priority_single' ? '핵심' : '배치'} 저장 ${events.length}건${partial ? ' (부분 salvage)' : ''}: ${batchLabel}`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)

      if (rawText) {
        const salvaged = parseEventsWithFallback(rawText, batch)
        if (salvaged.events.length) {
          if (result.rawResponseSamples && result.rawResponseSamples.length < 3) {
            result.rawResponseSamples.push(
              `[${batchLabel}] (partial-after-error) ${rawText.slice(0, 500)}`,
            )
          }
          appendCoverageGapErrors(result.errorDetails, salvaged.coverageGaps, true)
          await saveBatchEvents(salvaged.events, year, result)
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

  if (result.saved > 0) {
    result.reviewNotice =
      `신규 ${result.saved}개 이벤트가 draft로 수집되었습니다. 1·2·8월 일본·베트남·태국 등 누락 보강분 포함 — /admin/marketing/curation-events 에서 검토 후 approve하세요.`
  } else if (result.collected > 0 && (result.skippedApproved ?? 0) > 0) {
    result.reviewNotice =
      `기존 approved ${result.skippedApproved}건은 유지했습니다. 신규 draft 없음 — 월별 누락은 errorDetails를 확인하세요.`
  }

  result.errors = result.errorDetails.length
  debugLog('curation-event', '완료:', result)
  return result
}
