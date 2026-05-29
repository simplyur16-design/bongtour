/**
 * 시즌 히어로(메인·해외 허브) — cityKey/fallbackKeys 도시별 hero-eligible 상품 검증·교체 SSOT.
 * 조건: registered + travelScope='overseas' + ProductCityTag(또는 Product.cityKey) 일치 + bgImageUrl 존재.
 */
import { prisma } from '@/lib/prisma'
import { publicProductWhereClause } from '@/lib/product-sales-policy'

export type HeroCityKeyReplacement = { from: string; to: string }

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

/** 풀 내 도시 중 hero-eligible(등록·해외·bgImageUrl·태그/cityKey) cityKey 집합 */
export async function loadHeroEligibleCityKeySet(poolKeys: string[], now = new Date()): Promise<Set<string>> {
  const pool = uniqPreserveOrder(poolKeys)
  if (pool.length === 0) return new Set()

  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      travelScope: 'overseas',
      bgImageUrl: { not: null },
      AND: [
        publicProductWhereClause(now),
        {
          OR: [{ cityKey: { in: pool } }, { cityTags: { some: { cityKey: { in: pool } } } }],
        },
      ],
    },
    select: {
      bgImageUrl: true,
      cityKey: true,
      cityTags: { select: { cityKey: true } },
    },
  })

  const poolSet = new Set(pool)
  const eligible = new Set<string>()
  for (const p of rows) {
    if (!p.bgImageUrl?.trim()) continue
    if (p.cityKey && poolSet.has(p.cityKey)) eligible.add(p.cityKey)
    for (const t of p.cityTags) {
      if (poolSet.has(t.cityKey)) eligible.add(t.cityKey)
    }
  }
  return eligible
}

/**
 * primary 순서 유지 — 상품 없는 슬롯은 fallbackKeys에서 순차 교체(미사용·eligible만).
 */
export function resolveHeroCityKeysWithProductFallback(
  primaryKeys: string[],
  fallbackKeys: string[],
  eligible: Set<string>,
  targetCount = 5,
): { resolved: string[]; replacements: HeroCityKeyReplacement[] } {
  const primary = uniqPreserveOrder(primaryKeys).slice(0, targetCount)
  const fallback = uniqPreserveOrder(fallbackKeys)
  const used = new Set<string>()
  const resolved: string[] = []
  const replacements: HeroCityKeyReplacement[] = []

  let fallbackIdx = 0
  const takeNextFallback = (): string | null => {
    while (fallbackIdx < fallback.length) {
      const k = fallback[fallbackIdx]!
      fallbackIdx += 1
      if (used.has(k) || !eligible.has(k)) continue
      return k
    }
    return null
  }

  for (const key of primary) {
    if (resolved.length >= targetCount) break
    if (eligible.has(key) && !used.has(key)) {
      resolved.push(key)
      used.add(key)
      continue
    }
    const rep = takeNextFallback()
    if (rep) {
      resolved.push(rep)
      used.add(rep)
      replacements.push({ from: key, to: rep })
    }
  }

  while (resolved.length < targetCount) {
    const rep = takeNextFallback()
    if (!rep) break
    resolved.push(rep)
    used.add(rep)
  }

  return { resolved: resolved.slice(0, targetCount), replacements }
}

export function logHeroCityKeyReplacements(replacements: HeroCityKeyReplacement[], logPrefix: string): void {
  for (const { from, to } of replacements) {
    console.log(`${logPrefix} ${from} → ${to}`)
  }
}
