import { prisma } from '@/lib/prisma'

const MAX_COUNTRIES_FOR_COLLECTION = 30

export type CurationEventTargetMode =
  | 'recommendation'
  | 'curation'
  | 'all_products'
  | 'union'

export interface CurationEventRefreshOptions {
  targetMode?: CurationEventTargetMode
  /** recommendation 모드 — 클라이언트 추천 카드 country 배열 */
  targetCountries?: string[]
  /** PR (가)-6.3 — 최근 N일 이내 수집된 국가 스킵 (default false) */
  skipRecent?: boolean
  /** skipRecent 시 기준 일수 (default 30) */
  recentDays?: number
  /** PR (가)-6.3 — targetCountries(추천 국가)를 갱신 목록 앞쪽에 배치 */
  prioritizeRecommendationCities?: boolean
}

export interface ResolvedCurationEventTargets {
  countries: string[]
  targetMode: CurationEventTargetMode
  /** curation 모드에서 상품 국가로 대체된 경우 */
  usedProductFallback?: boolean
}

const VALID_TARGET_MODES = new Set<CurationEventTargetMode>([
  'recommendation',
  'curation',
  'all_products',
  'union',
])

function hasHangul(value: string): boolean {
  return /[\uAC00-\uD7A3]/.test(value)
}

function slugToKoreanFallback(slug: string): string {
  return slug
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function normalizeCountryKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function dedupeCountryLabels(labels: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const label of labels) {
    const trimmed = label.trim()
    if (!trimmed) continue
    const key = normalizeCountryKey(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

/** 슬러그·한글 혼재 countryCode → 한국어 라벨 */
export async function resolveCountryLabelsToKorean(codes: string[]): Promise<string[]> {
  if (!codes.length) return []

  const countryRows = await prisma.country.findMany({
    select: { countryKey: true, koreanLabel: true },
  })
  const labelByKey = new Map(countryRows.map((r) => [r.countryKey, r.koreanLabel]))
  const keyByLabel = new Map(
    countryRows.map((r) => [normalizeCountryKey(r.koreanLabel), r.koreanLabel]),
  )

  const resolved: string[] = []
  for (const raw of codes) {
    const v = raw.trim()
    if (!v) continue

    if (hasHangul(v)) {
      resolved.push(keyByLabel.get(normalizeCountryKey(v)) ?? v)
      continue
    }

    const slug = v.toLowerCase()
    resolved.push(labelByKey.get(slug) ?? slugToKoreanFallback(slug))
  }

  return dedupeCountryLabels(resolved)
}

async function sortWithPriority(countries: string[]): Promise<string[]> {
  if (!countries.length) return []
  const { sortCountriesByPriority, PRIORITY_COUNTRIES } = await import(
    '@/lib/bong-marketing/curation-event-collector'
  )
  return sortCountriesByPriority(countries, PRIORITY_COUNTRIES)
}

/** Product 등록 국가 — 핵심 우선 정렬 후 상위 30 (기존 refresh 동작) */
async function getProductTargetCountriesForEventCollection(): Promise<string[]> {
  const { listBongtourProductCountryLabels } = await import(
    '@/lib/bong-marketing/curation-event-gemini-parse'
  )
  const labels = await listBongtourProductCountryLabels()
  return (await sortWithPriority(labels)).slice(0, MAX_COUNTRIES_FOR_COLLECTION)
}

/**
 * PR (가)-6 — 본체 큐레이션 국가 union
 * MonthlyCurationContent(발행) countryCode + 현재 SeasonalDestinationCuration 도시 → 국가
 */
export async function getCurationCountries(): Promise<string[]> {
  const monthlyRows = await prisma.monthlyCurationContent.findMany({
    where: {
      pageScope: 'overseas',
      isPublished: true,
      countryCode: { not: null },
    },
    select: { countryCode: true },
    distinct: ['countryCode'],
  })

  const cycle = await prisma.seasonalDestinationCuration.findFirst({
    where: {
      cycleStartDate: { lte: new Date() },
      cycleEndDate: { gt: new Date() },
    },
    orderBy: { cycleStartDate: 'desc' },
    select: { cityKeys: true, fallbackKeys: true },
  })

  const cityKeys = [...new Set([...(cycle?.cityKeys ?? []), ...(cycle?.fallbackKeys ?? [])])]

  let seasonalLabels: string[] = []
  if (cityKeys.length) {
    const cities = await prisma.city.findMany({
      where: { cityKey: { in: cityKeys } },
      include: { country: { select: { koreanLabel: true } } },
    })
    seasonalLabels = cities
      .map((c) => c.country?.koreanLabel?.trim())
      .filter((v): v is string => Boolean(v))
  }

  const rawCodes = [
    ...monthlyRows.map((r) => r.countryCode!).filter(Boolean),
    ...seasonalLabels,
  ]

  return resolveCountryLabelsToKorean(rawCodes)
}

export function parseCurationEventTargetMode(value: unknown): CurationEventTargetMode | undefined {
  if (typeof value !== 'string') return undefined
  const mode = value.trim() as CurationEventTargetMode
  return VALID_TARGET_MODES.has(mode) ? mode : undefined
}

export function parseTargetCountriesInput(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const labels = value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean)
  return labels.length ? labels : []
}

export async function resolveCurationEventTargetCountries(
  options?: CurationEventRefreshOptions,
): Promise<ResolvedCurationEventTargets> {
  const targetMode = options?.targetMode ?? 'all_products'

  if (targetMode === 'recommendation') {
    const countries = await sortWithPriority(
      await resolveCountryLabelsToKorean(options?.targetCountries ?? []),
    )
    return { countries, targetMode }
  }

  if (targetMode === 'curation') {
    let countries = await sortWithPriority(await getCurationCountries())
    if (!countries.length) {
      countries = await getProductTargetCountriesForEventCollection()
      return { countries, targetMode, usedProductFallback: true }
    }
    return { countries, targetMode }
  }

  if (targetMode === 'union') {
    const [recommendation, curation, products] = await Promise.all([
      resolveCountryLabelsToKorean(options?.targetCountries ?? []),
      getCurationCountries(),
      getProductTargetCountriesForEventCollection(),
    ])
    const countries = await sortWithPriority(
      dedupeCountryLabels([...recommendation, ...curation, ...products]),
    )
    return { countries, targetMode }
  }

  const countries = await getProductTargetCountriesForEventCollection()
  return { countries, targetMode: 'all_products' }
}

/** 운영자 UI 미리보기 — 모드별 대상 국가 수 */
export async function previewCurationEventTargetCountries(
  options?: CurationEventRefreshOptions,
): Promise<ResolvedCurationEventTargets> {
  return resolveCurationEventTargetCountries(options)
}
