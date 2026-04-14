import { toSafeHttpUrl } from '@/lib/cms-source-attribution'
import { prisma } from '@/lib/prisma'
import { getSeoulYearMonthNow } from '@/lib/monthly-curation'

/** 모바일 홈 `시즌 추천` 1건용 — `MonthlyCurationContent` SSOT */
export type HomeSeasonPickDTO = {
  id: string
  title: string
  excerpt: string
  imageUrl: string | null
  ctaHref: string
  ctaLabel: string
  monthKey: string | null
}

function excerptBody(body: string, max: number): string {
  const t = body.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max).trimEnd()}…`
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
      select: {
        id: true,
        title: true,
        bodyKr: true,
        imageUrl: true,
        linkedProductId: true,
        linkedHref: true,
        ctaLabel: true,
        monthKey: true,
      },
    })
    const row =
      thisMonth ??
      (await prisma.monthlyCurationContent.findFirst({
        where: { pageScope: 'overseas', isPublished: true },
        orderBy: [{ monthKey: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          title: true,
          bodyKr: true,
          imageUrl: true,
          linkedProductId: true,
          linkedHref: true,
          ctaLabel: true,
          monthKey: true,
        },
      }))

    if (!row) return null

    const rawImg = (row.imageUrl ?? '').trim()
    const imageUrl = toSafeHttpUrl(rawImg) ?? (rawImg.startsWith('/') ? rawImg : null)

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

    return {
      id: row.id,
      title: row.title.trim() || '시즌 추천',
      excerpt: excerptBody(row.bodyKr ?? '', 120),
      imageUrl,
      ctaHref,
      ctaLabel: (row.ctaLabel ?? '').trim() || '관련 상품 보기',
      monthKey: row.monthKey ?? null,
    }
  } catch {
    return null
  }
}

/** DB에 발행 행이 없을 때 모바일 홈 카드 자리용(임시·보고용). */
export const HOME_SEASON_PICK_FALLBACK: HomeSeasonPickDTO = {
  id: 'fallback-mobile-home',
  title: '해외 패키지 둘러보기',
  excerpt: '일정·혜택을 확인하고 상담으로 이어가 보세요.',
  imageUrl: null,
  ctaHref: '/travel/overseas',
  ctaLabel: '관련 상품 보기',
  monthKey: null,
}

export async function getHomeSeasonPickForMobile(): Promise<{ pick: HomeSeasonPickDTO; fromDatabase: boolean }> {
  const fromDb = await getHomeSeasonPickFromMonthlyContent()
  if (fromDb) return { pick: fromDb, fromDatabase: true }
  return { pick: HOME_SEASON_PICK_FALLBACK, fromDatabase: false }
}
