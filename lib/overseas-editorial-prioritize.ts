import { cache } from 'react'
import { formatCmsSourceLine, toSafeHttpUrl } from '@/lib/cms-source-attribution'
import { prisma } from '@/lib/prisma'

function norm(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase()
}

/** `OverseasManagedContent`와 동일 — 기본 URL에서는 region/country 미지정 카드만 */
export function prioritizeEditorialsByRegionAndCountry<
  T extends { regionKey: string | null; countryCode: string | null },
>(items: T[], region: string | null | undefined, country: string | null | undefined): T[] {
  const r = norm(region)
  const c = norm(country)
  if (!r && !c) {
    return items.filter((x) => !x.regionKey && !x.countryCode)
  }
  const countryMatched = c ? items.filter((x) => norm(x.countryCode) === c) : []
  if (countryMatched.length > 0) return countryMatched
  const regionMatched = r ? items.filter((x) => norm(x.regionKey) === r) : []
  if (regionMatched.length > 0) return regionMatched
  return items.filter((x) => !x.regionKey && !x.countryCode)
}

async function fetchPublishedOverseasEditorialsInner() {
  return prisma.editorialContent.findMany({
    where: { pageScope: 'overseas', isPublished: true },
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    take: 12,
  })
}

/** 동일 요청에서 generateMetadata·페이지가 중복 조회하지 않도록 */
export const fetchPublishedOverseasEditorials = cache(fetchPublishedOverseasEditorialsInner)

export function editorialBodyExcerpt(bodyKr: string, maxChars: number): string {
  const t = bodyKr.trim().replace(/\s+/g, ' ')
  if (t.length <= maxChars) return t
  return `${t.slice(0, maxChars).trim()}…`
}

/** 공개 페이지(여행상품 중간·단독여행 히어로)로 넘기는 직렬화 가능 페이로드 */
export type OverseasEditorialBriefingPayload = {
  title: string
  subtitle: string | null
  excerpt: string
}

export type PrivateTripHeroBriefingPayload = {
  /** 카드 표시 제목(본문 제목 우선, 없으면 SEO 제목) */
  title: string
  subtitle: string | null
  excerpt: string
  /** CMS `cardTags` — 없으면 빈 배열 */
  tags: string[]
  imageUrl: string | null
  imageAlt: string | null
  /** 동일 목록의 다른 에디토리얼 히어로(최대 2) — 보조 썸네일 슬롯 */
  supportingThumbs?: { url: string; alt: string }[]
  ctaHref: string | null
  ctaLabel: string | null
  sourceLine: string | null
}

export function editorialRowToBriefingPayload(
  row:
    | { title: string; subtitle: string | null; bodyKr: string }
    | undefined
    | null,
  excerptMax: number
): OverseasEditorialBriefingPayload | null {
  if (!row) return null
  return {
    title: row.title,
    subtitle: row.subtitle,
    excerpt: editorialBodyExcerpt(row.bodyKr, excerptMax),
  }
}

function cardTagsFromRow(cardTags: string | null | undefined): string[] {
  return (cardTags ?? '')
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12)
}

/** 전역(미지정 권역) 에디토리얼 중 단독여행 히어로 후보 1건 */
export function selectPrivateTripHeroEditorialRow<
  T extends {
    id: string
    sortOrder: number
    updatedAt: Date
    privateTripHeroSlot?: boolean
  },
>(globalPrioritized: T[]): T | null {
  if (globalPrioritized.length === 0) return null
  const pinned = globalPrioritized.filter((r) => r.privateTripHeroSlot === true)
  const pool = pinned.length > 0 ? pinned : globalPrioritized
  const sorted = [...pool].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return b.updatedAt.getTime() - a.updatedAt.getTime()
  })
  return sorted[0] ?? null
}

export function editorialRowToPrivateHeroBriefing(
  row:
    | {
        title: string
        subtitle: string | null
        bodyKr: string
        seoTitle?: string | null
        heroImageUrl?: string | null
        heroImageAlt?: string | null
        sourceType?: string | null
        sourceName?: string | null
        sourceUrl?: string | null
        ctaLabel?: string | null
        ctaHref?: string | null
        cardTags?: string | null
      }
    | undefined
    | null,
  excerptMax: number,
  opts?: { defaultCtaHref?: string; defaultCtaLabel?: string }
): PrivateTripHeroBriefingPayload | null {
  if (!row) return null
  const title =
    (row.title && row.title.trim()) || (row.seoTitle && row.seoTitle.trim()) || ''
  if (!title) return null
  const img = toSafeHttpUrl(row.heroImageUrl)
  const ctaHref = (row.ctaHref && row.ctaHref.trim()) || opts?.defaultCtaHref || null
  const ctaLabel = (row.ctaLabel && row.ctaLabel.trim()) || opts?.defaultCtaLabel || null
  return {
    title,
    subtitle: row.subtitle,
    excerpt: editorialBodyExcerpt(row.bodyKr, excerptMax),
    tags: cardTagsFromRow(row.cardTags),
    imageUrl: img,
    imageAlt: (row.heroImageAlt && row.heroImageAlt.trim()) || title,
    ctaHref,
    ctaLabel,
    sourceLine: formatCmsSourceLine(row.sourceName, row.sourceUrl, row.sourceType),
  }
}
