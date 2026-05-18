/**
 * 메인 영역 6 — 페르소나 큐레이션 도시 카드 (PR-D3-B).
 * 시즌 사이클: `SeasonalDestinationCuration` + `getCurrentCycle` (메모리 #28, PR #16 D3-A).
 * 노출 상품: registered + `publicProductWhereClause` (메모리 #25 룰 B).
 */
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { getCurrentCycle, getProductCityDistribution } from '@/lib/season-curation'
import { getHomeHubCoverImageUrl } from '@/lib/final-image-selection'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import type { PersonaTabKey } from '@/lib/main-hub-copy'

export type PersonaCityCard = {
  cityKey: string
  titleEn: string
  koreanSubtitle: string
  countryKey: string | null
  countryKoreanLabel: string | null
  imageUrl: string | null
  withParents: boolean
  withKids: boolean
  couple: boolean
}

export type PersonaCuratedDestinationsPayload = {
  cycle: {
    id: string
    cycleStartDate: string
    cycleEndDate: string
    cityKeys: string[]
    fallbackKeys: string[]
  } | null
  cards: PersonaCityCard[]
  /** 탭별 노출 가능한 도시 수(서버 계산, 운영 점검용) */
  tabCityCounts: Record<PersonaTabKey, number>
}

const LABEL_PARENTS = 'with-parents'
const LABEL_KIDS = 'with-kids'
const LABEL_COUPLE = 'couple'

function uniqPreserveOrder(keys: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const k of keys) {
    const t = String(k).trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

function cityKeyToEnglishTitle(cityKey: string): string {
  return cityKey
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function stablePickIndex(seed: string, modulo: number): number {
  if (modulo <= 0) return 0
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % modulo
}

function hasLabel(labels: string[] | null | undefined, key: string): boolean {
  return Array.isArray(labels) && labels.includes(key)
}

function resolveFiveCityKeys(
  cycle: Awaited<ReturnType<typeof getCurrentCycle>>,
  dist: Map<string, { count: number }>,
): string[] {
  const primary = uniqPreserveOrder(cycle?.cityKeys ?? [])
  const fallback = uniqPreserveOrder(cycle?.fallbackKeys ?? [])
  const out: string[] = []
  for (const k of primary) {
    if (out.length >= 5) break
    out.push(k)
  }
  for (const k of fallback) {
    if (out.length >= 5) break
    if (!out.includes(k)) out.push(k)
  }
  for (const k of dist.keys()) {
    if (out.length >= 5) break
    if (!out.includes(k)) out.push(k)
  }
  return out.slice(0, 5)
}

function tabCountsForCards(cards: PersonaCityCard[]): Record<PersonaTabKey, number> {
  return {
    all: cards.length,
    'with-parents': cards.filter((c) => c.withParents).length,
    'with-kids': cards.filter((c) => c.withKids).length,
    couple: cards.filter((c) => c.couple).length,
  }
}

async function loadPersonaCuratedDestinationsUncached(): Promise<PersonaCuratedDestinationsPayload> {
  const now = new Date()
  const [cycle, dist] = await Promise.all([getCurrentCycle(now), getProductCityDistribution(now)])
  const cityKeys = resolveFiveCityKeys(cycle, dist)

  const cycleMeta = cycle
    ? {
        id: cycle.id,
        cycleStartDate: cycle.cycleStartDate.toISOString(),
        cycleEndDate: cycle.cycleEndDate.toISOString(),
        cityKeys: [...cycle.cityKeys],
        fallbackKeys: [...cycle.fallbackKeys],
      }
    : null

  if (cityKeys.length === 0) {
    const empty: PersonaCityCard[] = []
    return { cycle: cycleMeta, cards: empty, tabCityCounts: tabCountsForCards(empty) }
  }

  const cities = await prisma.city.findMany({
    where: { cityKey: { in: cityKeys } },
    include: { country: true },
  })
  const cityMeta = new Map(cities.map((c) => [c.cityKey, c]))

  const products = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      cityKey: { in: cityKeys },
      NOT: { travelScope: 'domestic' },
      AND: [publicProductWhereClause(now)],
    },
    select: {
      id: true,
      cityKey: true,
      personaLabels: true,
      bgImageUrl: true,
      schedule: true,
      itineraries: { select: { day: true, description: true }, orderBy: { day: 'asc' }, take: 24 },
    },
  })

  const byCity = new Map<string, typeof products>()
  for (const p of products) {
    const ck = p.cityKey
    if (!ck) continue
    if (!byCity.has(ck)) byCity.set(ck, [])
    byCity.get(ck)!.push(p)
  }

  const seedBase = cycle?.id ?? 'no-cycle'
  const cards: PersonaCityCard[] = []

  for (const cityKey of cityKeys) {
    const list = [...(byCity.get(cityKey) ?? [])].sort((a, b) => a.id.localeCompare(b.id))

    let withParents = false
    let withKids = false
    let couple = false
    for (const p of list) {
      const pl = p.personaLabels ?? []
      if (hasLabel(pl, LABEL_PARENTS)) withParents = true
      if (hasLabel(pl, LABEL_KIDS)) withKids = true
      if (hasLabel(pl, LABEL_COUPLE)) couple = true
    }

    let imageUrl: string | null = null
    if (list.length > 0) {
      const start = stablePickIndex(`${seedBase}:${cityKey}`, list.length)
      for (let step = 0; step < list.length; step++) {
        const p = list[(start + step) % list.length]!
        const scheduleDays = getScheduleFromProduct(p)
        const url = getHomeHubCoverImageUrl({ bgImageUrl: p.bgImageUrl, scheduleDays })?.trim() ?? null
        if (url) {
          imageUrl = url
          break
        }
      }
    }

    const meta = cityMeta.get(cityKey)
    const ko = meta?.koreanLabel ?? cityKey
    const countryKo = meta?.country?.koreanLabel ?? ''
    const koreanSubtitle = countryKo ? `${ko} · ${countryKo}` : ko

    cards.push({
      cityKey,
      titleEn: cityKeyToEnglishTitle(cityKey),
      koreanSubtitle,
      countryKey: meta?.countryKey ?? null,
      countryKoreanLabel: meta?.country?.koreanLabel ?? null,
      imageUrl,
      withParents,
      withKids,
      couple,
    })
  }

  return { cycle: cycleMeta, cards, tabCityCounts: tabCountsForCards(cards) }
}

export async function getPersonaCuratedDestinationsPayload(): Promise<PersonaCuratedDestinationsPayload> {
  const cycle = await getCurrentCycle(new Date())
  const cacheKey = ['persona-curated-destinations', cycle?.id ?? 'no-active-cycle']
  const run = unstable_cache(() => loadPersonaCuratedDestinationsUncached(), cacheKey, { revalidate: 21_600 })
  return run()
}
