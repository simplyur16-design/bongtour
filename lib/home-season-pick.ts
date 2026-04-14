import { toSafePublicUrlOrPath } from '@/lib/cms-source-attribution'
import { buildPublicUrlForObjectKey, isObjectStorageConfigured } from '@/lib/object-storage'
import { prisma } from '@/lib/prisma'
import { getSeoulYearMonthNow } from '@/lib/monthly-curation'

/** 모바일 홈 `시즌 추천` — `MonthlyCurationContent` SSOT */
export type HomeSeasonPickDTO = {
  id: string
  title: string
  excerpt: string
  /** 원문 본문 — 모바일 시즌 카드 더보기용 */
  bodyFull: string
  imageUrl: string | null
  ctaHref: string
  ctaLabel: string
  monthKey: string | null
  /** CMS 국가 연결 — 해외 목록 삽입 규칙과 동일 필드명 */
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
}

function monthlyRowToHomeSeasonPickDTO(row: MonthlyRow): HomeSeasonPickDTO {
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

  return {
    id: row.id,
    title: row.title.trim() || '시즌 추천',
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
    return monthlyRowToHomeSeasonPickDTO(row as MonthlyRow)
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
 * 모바일 홈 시즌 추천 캐러셀 — 발행 행 최대 5건(정렬 동일).
 * 없으면 폴백 1건 + `padHomeSeasonSlidesToFive`에서 에디토리얼 슬롯으로 채움.
 */
export async function getHomeSeasonPicksForMobileCarousel(): Promise<{
  picks: HomeSeasonPickDTO[]
  fromDatabase: boolean
}> {
  const monthKey = getSeoulYearMonthNow()
  try {
    let rows = await prisma.monthlyCurationContent.findMany({
      where: { pageScope: 'overseas', isPublished: true, monthKey },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      take: 5,
      select: monthlySelect,
    })
    if (rows.length === 0) {
      rows = await prisma.monthlyCurationContent.findMany({
        where: { pageScope: 'overseas', isPublished: true },
        orderBy: [{ monthKey: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
        take: 5,
        select: monthlySelect,
      })
    }
    if (rows.length > 0) {
      return { picks: rows.map((r) => monthlyRowToHomeSeasonPickDTO(r as MonthlyRow)), fromDatabase: true }
    }
  } catch {
    // fall through
  }
  return { picks: [HOME_SEASON_PICK_FALLBACK], fromDatabase: false }
}
