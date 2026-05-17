'use server'

import { prisma } from '@/lib/prisma'

/** 메가메뉴 SSOT 카드 → 연결된 마스터 도시 키 (정렬 유지) */
export async function resolveBrowseCardKeyToCityKeys(cardKey: string | null | undefined): Promise<string[]> {
  const k = (cardKey ?? '').trim()
  if (!k) return []
  const rows = await prisma.megaMenuGroupCardCity.findMany({
    where: { cardKey: k },
    select: { cityKey: true },
    orderBy: { sortOrder: 'asc' },
  })
  return rows.map((r) => r.cityKey)
}

/** 메가메뉴 SSOT 카드 → 연결된 마스터 국가 키 */
export async function resolveBrowseCardKeyToCountryKeys(cardKey: string | null | undefined): Promise<string[]> {
  const k = (cardKey ?? '').trim()
  if (!k) return []
  const rows = await prisma.megaMenuGroupCardCountry.findMany({
    where: { cardKey: k },
    select: { countryKey: true },
    orderBy: { sortOrder: 'asc' },
  })
  return rows.map((r) => r.countryKey)
}
