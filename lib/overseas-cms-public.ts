/** 공개 페이지용 CMS 직렬화(해외 허브·단독여행) */

import { formatCmsSourceLine, toSafeHttpUrl } from '@/lib/cms-source-attribution'
import { editorialBodyExcerpt } from '@/lib/overseas-editorial-prioritize'

export type MonthlyCurationMidPayload = {
  id: string
  monthKey: string
  title: string
  subtitle: string | null
  excerpt: string
  ctaLabel: string | null
  href: string | null
  imageUrl: string | null
  imageAlt: string | null
  sourceLine: string | null
  /** 시맨틱/스크린리더 보조 */
  seoTitle: string | null
}

export { formatCmsSourceLine, toSafeHttpUrl }

export type MonthlyCurationRowLike = {
  id: string
  monthKey: string
  title: string
  subtitle: string | null
  bodyKr: string
  ctaLabel: string | null
  linkedProductId: string | null
  linkedHref: string | null
  imageUrl: string | null
  imageAlt: string | null
  sourceType: string | null
  sourceName: string | null
  sourceUrl: string | null
  seoTitle: string | null
}

export function monthlyCurationRowToMidPayload(
  row: MonthlyCurationRowLike,
  excerptMax: number
): MonthlyCurationMidPayload {
  const href = row.linkedProductId
    ? `/products/${row.linkedProductId}`
    : toSafeHttpUrl(row.linkedHref)
  return {
    id: row.id,
    monthKey: row.monthKey,
    title: (row.seoTitle && row.seoTitle.trim()) || row.title,
    subtitle: row.subtitle,
    excerpt: editorialBodyExcerpt(row.bodyKr, excerptMax),
    ctaLabel: row.ctaLabel,
    href,
    imageUrl: toSafeHttpUrl(row.imageUrl),
    imageAlt: (row.imageAlt && row.imageAlt.trim()) || row.title,
    sourceLine: formatCmsSourceLine(row.sourceName, row.sourceUrl, row.sourceType),
    seoTitle: row.seoTitle,
  }
}
