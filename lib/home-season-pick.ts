import { toSafePublicUrlOrPath } from '@/lib/cms-source-attribution'
import { buildPublicUrlForObjectKey, isObjectStorageConfigured } from '@/lib/object-storage'
import { prisma } from '@/lib/prisma'
import { getSeoulYearMonthNow } from '@/lib/monthly-curation'
import type { HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'
import { excerptBody, stripSupabaseStorageForHomeSeasonImage } from '@/lib/home-season-pick-shared'
import { resolveMonthlyCurationProductCountrySlug } from '@/lib/monthly-curation-product-country'

/** 타입만 재보냄. `normalizeHomeSeasonSlidesForClient`는 클라이언트에서 `@/lib/home-season-pick-shared`만 import. */
export type { HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'

type MonthlyRow = {
  id: string
  title: string
  subtitle: string | null
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
  imageUrl = stripSupabaseStorageForHomeSeasonImage(imageUrl)

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
  const subtitle = (row.subtitle ?? '').trim() || null
  const resolvedProductCountrySlug = resolveMonthlyCurationProductCountrySlug(row.countryCode, title)

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
    subtitle,
    resolvedProductCountrySlug,
  }
}

const monthlySelect = {
  id: true,
  title: true,
  subtitle: true,
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
 * 해외 시즌 추천 — `pageScope=overseas` 이고 **발행(`isPublished`)인 행 전부**.
 * 대표 1건·URL 국가 필터·region/country 슬라이스 없음. 정렬: sortOrder → monthKey → updatedAt.
 */
export async function getPublishedOverseasSeasonCurationSlides(): Promise<HomeSeasonPickDTO[]> {
  try {
    const rows = await prisma.monthlyCurationContent.findMany({
      where: { pageScope: 'overseas', isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { monthKey: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
      select: monthlySelect,
    })
    const slides = rows.map((r) => monthlyCurationRowToHomeSeasonPickDTO(r as MonthlyRow))
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[season-curation]', {
        fetchedRowCount: rows.length,
        publishedRowCount: rows.length,
        carouselSlideCount: slides.length,
      })
    }
    return slides
  } catch {
    return []
  }
}

/** @deprecated 동일 동작 — 이름만 유지 */
export const getSeasonCurationSlidesForMobileHome = getPublishedOverseasSeasonCurationSlides

/**
 * 해외 상품 목록 일본 아래 슬롯 — **발행 전부** 순환(위치만 고정, 콘텐츠 필터 없음).
 * `_region` / `_country`는 시그니처 호환용으로만 남김(사용하지 않음).
 */
export async function getSeasonCurationSlidesForOverseasProductHub(
  _region?: string | null,
  _country?: string | null
): Promise<HomeSeasonPickDTO[]> {
  return getPublishedOverseasSeasonCurationSlides()
}

/** 해외 허브 상단 — 서울 기준 `monthKey` 월의 발행 큐레이션만 */
export async function getPublishedOverseasMonthlyCurationsForMonth(monthKey: string): Promise<HomeSeasonPickDTO[]> {
  try {
    const rows = await prisma.monthlyCurationContent.findMany({
      where: { pageScope: 'overseas', isPublished: true, monthKey },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      select: monthlySelect,
    })
    return rows.map((r) => monthlyCurationRowToHomeSeasonPickDTO(r as MonthlyRow))
  } catch {
    return []
  }
}

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
  subtitle: null,
  resolvedProductCountrySlug: null,
}

export async function getHomeSeasonPickForMobile(): Promise<{ pick: HomeSeasonPickDTO; fromDatabase: boolean }> {
  const fromDb = await getHomeSeasonPickFromMonthlyContent()
  if (fromDb) return { pick: fromDb, fromDatabase: true }
  return { pick: HOME_SEASON_PICK_FALLBACK, fromDatabase: false }
}
