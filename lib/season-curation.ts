/**
 * 메인 시즌 추천 도시 사이클 — Gemini + Product 도시 분포 (PR-D3-A).
 * 메모리 #28 시즌 SSOT, #25 노출: registered + (lastFutureDepartureDate IS NULL OR > now).
 */
import type { SeasonalDestinationCuration } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { extractFirstBalancedJsonObject, stripLlmMarkdownJsonFence } from '@/lib/llm-json-extract'
import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'

const SEASON_MODEL = process.env.GEMINI_SEASON_CURATION_MODEL?.trim() || getModelName()

export type CityDistributionRow = {
  count: number
  koreanLabel: string
  country: string
  countryKey: string
}

/** 서울 벽시계 + 계절 힌트 — Gemini `현재 시기` 컨텍스트 */
export function buildSeasonContext(now = new Date()): string {
  const wall = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(now)
  const m = parseInt(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', month: 'numeric' }).format(now),
    10,
  )
  let seasonalHint = '계절 전환기'
  if (m >= 3 && m <= 5) seasonalHint = '늦봄, 동남아 우기 시작, 일본 골든위크 직후, 유럽 성수기 진입 전'
  else if (m >= 6 && m <= 8) seasonalHint = '한여름, 휴가·피서 수요, 장마·태풍 시즌 고려'
  else if (m >= 9 && m <= 11) seasonalHint = '가을 성수기, 단풍·온화한 유럽·동남아 건기 전환'
  else seasonalHint = '겨울·연말연시, 남반구·스키·온천 시즌'
  return `${wall} (${seasonalHint})`
}

/**
 * Gemini 프롬프트 본문 — 변수만 치환하고 문구는 스펙 그대로 유지.
 * (distributionTop30: 상위 도시 cityKey + 건수 + 한글 라벨 요약 문자열)
 */
export function buildSeasonCurationGeminiPrompt(context: string, distributionTop30: string): string {
  return `한국 출발 패키지 여행사의 메인 페이지 '이번 시즌 추천 여행지' 5개 도시를 골라줘.
현재 시기: ${context}
조건: 
- 우리 카탈로그에 registered 상품이 있는 도시만 (아래 분포 참고)
- 시기 적합성(기후·이벤트·계절) 우선
- 다양성 (같은 국가 중복 최소화, 권역 분산)
- 가족 패키지(40대 후반 부모님과 가족) 친화
도시 분포(상품 수): ${distributionTop30}
응답: JSON {"primary": [cityKey 5], "fallback": [cityKey 10], "reasoning": {cityKey: 한줄 이유}}`
}

function formatDistributionTop30(dist: Map<string, CityDistributionRow>): string {
  const lines: string[] = []
  let i = 0
  for (const [cityKey, row] of dist) {
    if (i++ >= 30) break
    lines.push(`${cityKey}: ${row.count}건 (${row.country} · ${row.koreanLabel})`)
  }
  return lines.join('\n')
}

type GeminiCityPick = {
  primary: string[]
  fallback: string[]
  reasoning?: Record<string, string>
}

export async function getCurrentCycle(now = new Date()): Promise<SeasonalDestinationCuration | null> {
  return prisma.seasonalDestinationCuration.findFirst({
    where: {
      cycleStartDate: { lte: now },
      cycleEndDate: { gt: now },
    },
    orderBy: { cycleStartDate: 'desc' },
  })
}

/**
 * registered 해외 성격 상품, cityKey 있음, 미래 출발일 없음 또는 미래 출발일 > now.
 */
export async function getProductCityDistribution(now = new Date()): Promise<Map<string, CityDistributionRow>> {
  const grouped = await prisma.product.groupBy({
    by: ['cityKey'],
    where: {
      registrationStatus: 'registered',
      NOT: { travelScope: 'domestic' },
      cityKey: { not: null },
      OR: [{ lastFutureDepartureDate: null }, { lastFutureDepartureDate: { gt: now } }],
    },
    _count: { _all: true },
  })

  const sorted = grouped
    .filter((g): g is (typeof grouped)[number] & { cityKey: string } => g.cityKey != null)
    .sort((a, b) => b._count._all - a._count._all)

  const keys = sorted.map((s) => s.cityKey)
  if (keys.length === 0) return new Map()

  const cities = await prisma.city.findMany({
    where: { cityKey: { in: keys } },
    include: { country: true },
  })
  const cityMeta = new Map(cities.map((c) => [c.cityKey, c]))

  const out = new Map<string, CityDistributionRow>()
  for (const row of sorted) {
    const ck = row.cityKey
    const meta = cityMeta.get(ck)
    out.set(ck, {
      count: row._count._all,
      koreanLabel: meta?.koreanLabel ?? ck,
      country: meta?.country?.koreanLabel ?? '',
      countryKey: meta?.countryKey ?? '',
    })
  }
  return out
}

function uniqPreserveOrder(keys: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const k of keys) {
    const t = k.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

async function loadCityMasterKeys(cityKeys: string[]): Promise<Set<string>> {
  if (cityKeys.length === 0) return new Set()
  const rows = await prisma.city.findMany({
    where: { cityKey: { in: cityKeys } },
    select: { cityKey: true },
  })
  return new Set(rows.map((r) => r.cityKey))
}

function normalizePicks(
  parsed: GeminiCityPick,
  allowedCatalog: Set<string>,
  masterKeys: Set<string>,
  sortedCatalogKeys: string[],
): { primary: string[]; fallback: string[]; reasoning: Record<string, string> } {
  const reasoning = parsed.reasoning && typeof parsed.reasoning === 'object' ? parsed.reasoning : {}

  const rawPrimary = uniqPreserveOrder(Array.isArray(parsed.primary) ? parsed.primary.map(String) : [])
  const rawFallback = uniqPreserveOrder(Array.isArray(parsed.fallback) ? parsed.fallback.map(String) : [])

  const valid = (k: string) => allowedCatalog.has(k) && masterKeys.has(k)

  let primary = rawPrimary.filter(valid)
  let fallback = rawFallback.filter(valid).filter((k) => !primary.includes(k))

  for (const k of sortedCatalogKeys) {
    if (primary.length >= 5) break
    if (!valid(k) || primary.includes(k)) continue
    primary.push(k)
  }
  for (const k of sortedCatalogKeys) {
    if (fallback.length >= 10) break
    if (!valid(k) || primary.includes(k) || fallback.includes(k)) continue
    fallback.push(k)
  }

  primary = primary.slice(0, 5)
  fallback = fallback.slice(0, 10)

  return { primary, fallback, reasoning }
}

export type GenerateNewCycleInput = {
  startDate: Date
  endDate: Date
  /** 예약: D3-B에서 동일 호출 경로 확장 시 사용 */
  force?: boolean
}

export async function generateNewCycle(input: GenerateNewCycleInput): Promise<SeasonalDestinationCuration> {
  const { startDate, endDate, force = false } = input
  const now = new Date()
  const dist = await getProductCityDistribution(now)
  if (dist.size === 0) {
    throw new Error('도시 분포가 비어 있습니다. registered 해외 상품에 cityKey가 있는지 확인하세요.')
  }

  const sortedCatalogKeys = [...dist.keys()]
  const allowedCatalog = new Set(sortedCatalogKeys)

  const context = buildSeasonContext(now)
  const distributionTop30 = formatDistributionTop30(dist)
  const prompt = buildSeasonCurationGeminiPrompt(context, distributionTop30)

  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY(또는 GOOGLE_API_KEY)가 설정되어 있지 않습니다.')
  }

  const model = getGenAI().getGenerativeModel({ model: SEASON_MODEL })
  let text: string
  try {
    const result = await model.generateContent(
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.65,
          maxOutputTokens: 4096,
          ...( { responseMimeType: 'application/json' } as { responseMimeType?: string }),
        },
      },
      geminiTimeoutOpts(120_000),
    )
    text = result.response.text()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Gemini 호출 실패: ${msg}`)
  }

  const rawStripped = stripLlmMarkdownJsonFence(text.trim())
  const objStr = extractFirstBalancedJsonObject(rawStripped) ?? extractFirstBalancedJsonObject(text)
  if (!objStr) {
    throw new Error('응답에서 JSON 객체를 찾지 못했습니다.')
  }
  let parsedUnknown: unknown
  try {
    parsedUnknown = JSON.parse(objStr) as unknown
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`JSON.parse 실패: ${msg}`)
  }
  if (!parsedUnknown || typeof parsedUnknown !== 'object') {
    throw new Error('최상위 JSON이 객체가 아닙니다.')
  }
  const p = parsedUnknown as Record<string, unknown>
  const parsed: GeminiCityPick = {
    primary: Array.isArray(p.primary) ? (p.primary as unknown[]).map(String) : [],
    fallback: Array.isArray(p.fallback) ? (p.fallback as unknown[]).map(String) : [],
    reasoning:
      p.reasoning && typeof p.reasoning === 'object' && !Array.isArray(p.reasoning)
        ? (p.reasoning as Record<string, string>)
        : undefined,
  }

  const candidateKeys = uniqPreserveOrder([...parsed.primary, ...parsed.fallback])
  const masterKeys = await loadCityMasterKeys(
    candidateKeys.length ? candidateKeys : sortedCatalogKeys.slice(0, 40),
  )

  const { primary, fallback, reasoning } = normalizePicks(parsed, allowedCatalog, masterKeys, sortedCatalogKeys)

  if (primary.length < 5) {
    throw new Error(`primary 도시가 5개 미만입니다 (${primary.length}). 카탈로그·City 마스터를 확인하세요.`)
  }
  if (fallback.length < 10) {
    throw new Error(`fallback 도시가 10개 미만입니다 (${fallback.length}). 카탈로그·City 마스터를 확인하세요.`)
  }

  const geminiResponse = {
    primary,
    fallback,
    reasoning,
    rawText: text,
    model: SEASON_MODEL,
  }

  if (force) {
    await prisma.seasonalDestinationCuration.deleteMany({ where: { cycleStartDate: startDate } })
  }

  return prisma.$transaction(async (tx) => {
    return tx.seasonalDestinationCuration.create({
      data: {
        cycleStartDate: startDate,
        cycleEndDate: endDate,
        cityKeys: primary,
        fallbackKeys: fallback,
        geminiPrompt: prompt,
        geminiResponse: geminiResponse as object,
        notes: null,
      },
    })
  })
}

export async function rotateCycleIfDue(
  now = new Date(),
  opts?: { force?: boolean },
): Promise<{ rotated: boolean; cycle: SeasonalDestinationCuration | null; message?: string }> {
  const force = Boolean(opts?.force)

  if (!force) {
    const current = await getCurrentCycle(now)
    if (current && current.cycleEndDate > now) {
      return { rotated: false, cycle: current }
    }
  } else {
    await prisma.seasonalDestinationCuration.updateMany({
      where: {
        cycleStartDate: { lte: now },
        cycleEndDate: { gt: now },
      },
      data: { cycleEndDate: now },
    })
  }

  const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  try {
    const cycle = await generateNewCycle({ startDate: now, endDate, force })
    return { rotated: true, cycle }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[season-curation] rotateCycleIfDue', e)
    return { rotated: false, cycle: null, message }
  }
}
