import { toSafePublicUrlOrPath } from '@/lib/cms-source-attribution'
import { buildPublicUrlForObjectKey, isObjectStorageConfigured } from '@/lib/object-storage'
import { prisma } from '@/lib/prisma'
import { getSeoulYearMonthNow } from '@/lib/monthly-curation'
import { prioritizeEditorialsByRegionAndCountry } from '@/lib/overseas-editorial-prioritize'

/** 모바일 홈·해외 상품 허브 공통 — `MonthlyCurationContent` 발행 행 → 순환 카드 */
export type HomeSeasonPickDTO = {
  id: string
  title: string
  excerpt: string
  /** 원문 본문 — 더보기 펼침용 */
  bodyFull: string
  imageUrl: string | null
  ctaHref: string
  ctaLabel: string
  monthKey: string | null
  relatedCountryCode: string | null
}

function excerptBody(body: string, max: number): string {
  const t = body.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max).trimEnd()}…`
}

type MonthlyRow = {
  id: string
  title: string
  bodyKr: string | null
  imageUrl: string | null
  imageStorageKey: string | null
  linkedProductId: string | null
  linkedHref: string | null
  ctaLabel: string | null
  monthKey: string | null
  countryCode: string | null
  regionKey: string | null
}

export function monthlyCurationRowToHomeSeasonPickDTO(row: MonthlyRow): HomeSeasonPickDTO {
  const bodyFull = (row.bodyKr ?? '').trim()
  let imageUrl = toSafePublicUrlOrPath(row.imageUrl)
  const key = (row.imageStorageKey ?? '').trim()
  if (!imageUrl && key && isObjectStorageConfigured()) {
    try {
      imageUrl = buildPublicUrlForObjectKey(key)
    } catch {
      imageUrl = null
    }
  }

  const productHref = row.linkedProductId?.trim()
    ? `/products/${row.linkedProductId!.trim()}`
    : null
  const rawHref = (row.linkedHref ?? '').trim()
  let ctaHref = productHref
  if (!ctaHref && rawHref) {
    try {
      const u = new URL(rawHref)
      if (u.protocol === 'http:' || u.protocol === 'https:') ctaHref = u.toString()
    } catch {
      if (rawHref.startsWith('/')) ctaHref = rawHref
    }
  }
  if (!ctaHref) ctaHref = '/travel/overseas'

  const cc = (row.countryCode ?? '').trim()
  const title = (row.title ?? '').trim()

  return {
    id: row.id,
    title,
    excerpt: excerptBody(bodyFull, 120),
    bodyFull,
    imageUrl,
    ctaHref,
    ctaLabel: (row.ctaLabel ?? '').trim() || '자세히 보기',
    monthKey: row.monthKey ?? null,
    relatedCountryCode: cc || null,
  }
}

const monthlySelect = {
  id: true,
  title: true,
  bodyKr: true,
  imageUrl: true,
  imageStorageKey: true,
  linkedProductId: true,
  linkedHref: true,
  ctaLabel: true,
  monthKey: true,
  countryCode: true,
  regionKey: true,
} as const

/**
 * 해외 스코프, 이번 달 `monthKey` 우선 → 없으면 최근 발행 1건.
 */
export async function getHomeSeasonPickFromMonthlyContent(): Promise<HomeSeasonPickDTO | null> {
  const monthKey = getSeoulYearMonthNow()
  try {
    const thisMonth = await prisma.monthlyCurationContent.findFirst({
      where: { pageScope: 'overseas', isPublished: true, monthKey },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      select: monthlySelect,
    })
    const row =
      thisMonth ??
      (await prisma.monthlyCurationContent.findFirst({
        where: { pageScope: 'overseas', isPublished: true },
        orderBy: [{ monthKey: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
        select: monthlySelect,
      }))

    if (!row) return null
    return monthlyCurationRowToHomeSeasonPickDTO(row as MonthlyRow)
  } catch {
    return null
  }
}

/** DB에 발행 행이 없을 때 모바일 홈 카드 자리용(임시·보고용). */
export const HOME_SEASON_PICK_FALLBACK: HomeSeasonPickDTO = {
  id: 'fallback-mobile-home',
  title: '해외 패키지 둘러보기',
  excerpt: '일정·혜택을 확인하고 상담으로 이어가 보세요.',
  bodyFull: '일정·혜택을 확인하고 상담으로 이어가 보세요.',
  imageUrl: null,
  ctaHref: '/travel/overseas',
  ctaLabel: '자세히 보기',
  monthKey: null,
  relatedCountryCode: null,
}

export async function getHomeSeasonPickForMobile(): Promise<{ pick: HomeSeasonPickDTO; fromDatabase: boolean }> {
  const fromDb = await getHomeSeasonPickFromMonthlyContent()
  if (fromDb) return { pick: fromDb, fromDatabase: true }
  return { pick: HOME_SEASON_PICK_FALLBACK, fromDatabase: false }
}

/**
 * 모바일 홈 시즌 추천 슬롯 — **발행된 행만** 길이 그대로 반환(패딩·샘플 금지).
 * 없으면 빈 배열.
 */
export async function getSeasonCurationSlidesForMobileHome(): Promise<HomeSeasonPickDTO[]> {
  const monthKey = getSeoulYearMonthNow()
  try {
    let rows = await prisma.monthlyCurationContent.findMany({
      where: { pageScope: 'overseas', isPublished: true, monthKey },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      take: 50,
      select: monthlySelect,
    })
    if (rows.length === 0) {
      rows = await prisma.monthlyCurationContent.findMany({
        where: { pageScope: 'overseas', isPublished: true },
        orderBy: [{ monthKey: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
        take: 50,
        select: monthlySelect,
      })
    }
    return rows.map((r) => monthlyCurationRowToHomeSeasonPickDTO(r as MonthlyRow))
  } catch {
    return []
  }
}

/**
 * `/travel/overseas` 상품 목록 — 시즌 추천 **일본 섹션 아래 고정**용 슬라이드 배열.
 * URL 필터와 동일한 우선순위로 어떤 글을 보여줄지만 결정하고, **삽입 위치는 호출부에서 일본 고정**.
 */
export async function getSeasonCurationSlidesForOverseasProductHub(
  region: string | null | undefined,
  country: string | null | undefined
): Promise<HomeSeasonPickDTO[]> {
  const monthKey = getSeoulYearMonthNow()
  try {
    let monthlyAll = await prisma.monthlyCurationContent.findMany({
      where: { pageScope: 'overseas', isPublished: true, monthKey },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      take: 50,
      select: monthlySelect,
    })
    if (monthlyAll.length === 0) {
      monthlyAll = await prisma.monthlyCurationContent.findMany({
        where: { pageScope: 'overseas', isPublished: true },
        orderBy: [{ monthKey: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
        take: 50,
        select: monthlySelect,
      })
    }
    const prioritized = prioritizeEditorialsByRegionAndCountry(monthlyAll, region, country)
    return prioritized.map((r) => monthlyCurationRowToHomeSeasonPickDTO(r as MonthlyRow))
  } catch {
    return []
  }
}
