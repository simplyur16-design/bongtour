/**
 * 공개 상품 상세 document title / OG title — 방안 B SEO 레이어.
 * H1(Product.title)과 분리해 원문 #태그·목적지·기간을 메타에 보강한다.
 */
import { SITE_NAME } from '@/lib/site-metadata'
import { extractHashtagLabelsFromText } from '@/lib/register-hero-seo-title-body-harvest'

export const PRODUCT_PUBLIC_SEO_TITLE_POLICY_VERSION = 'plan-b-v1-2026-06-10'

/** Google SERP 권장 근처(한글 혼합) */
const SEO_DOCUMENT_TITLE_SOFT_MAX = 58

function compactDurationForSeo(duration: string | null | undefined): string {
  const d = (duration ?? '').trim()
  if (!d) return ''
  const bm = d.match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (bm) return `${bm[1]}박${bm[2]}일`
  const day = d.match(/(?<!\d)(\d+)\s*일(?!\d)/)
  if (day) return `${day[1]}일`
  return d.replace(/\s+/g, ' ').slice(0, 16)
}

function titleAlreadyContains(haystack: string, needle: string): boolean {
  const h = haystack.replace(/\s/g, '').toLowerCase()
  const n = needle.replace(/\s/g, '').toLowerCase()
  return n.length >= 2 && h.includes(n)
}

export type ProductPublicSeoTitleInput = {
  displayTitle: string
  originalTitle?: string | null
  primaryDestination?: string | null
  destination?: string | null
  duration?: string | null
  siteName?: string
}

/**
 * `<title>`·OG용 — `displayTitle` + (목적지) + (#태그 1~2) + 기간 + 사이트명.
 */
export function buildProductPublicSeoDocumentTitle(input: ProductPublicSeoTitleInput): string {
  const site = (input.siteName ?? SITE_NAME).trim() || SITE_NAME
  const core = (input.displayTitle ?? '').trim() || '여행 상품'
  const dest = (input.primaryDestination ?? input.destination ?? '').trim()
  const dur = compactDurationForSeo(input.duration)
  const tagSource = (input.originalTitle ?? '').trim() || core
  const tags = extractHashtagLabelsFromText(tagSource, 2)

  const parts: string[] = [core]
  if (dest && !titleAlreadyContains(core, dest)) parts.push(dest)
  if (dur && !titleAlreadyContains(core, dur)) parts.push(dur)
  if (tags.length) {
    const tagBlock = tags.map((t) => `#${t}`).join(' ')
    if (!titleAlreadyContains(core, tags[0]!)) parts.push(tagBlock)
  }

  let body = `${parts.join(' · ')} · 여행 상품`
  if ([...body].length > SEO_DOCUMENT_TITLE_SOFT_MAX) {
    const shorterTags = tags.slice(0, 1).map((t) => `#${t}`).join(' ')
    body = shorterTags && !titleAlreadyContains(core, tags[0]!)
      ? `${core} · ${shorterTags} · 여행 상품`
      : `${core} · 여행 상품`
  }

  const withSite = `${body} | ${site}`
  return withSite.length > 72 ? `${core} · 여행 상품 | ${site}` : withSite
}

/** OG/Twitter 전용 짧은 제목 */
export function buildProductPublicSeoSocialTitle(input: ProductPublicSeoTitleInput): string {
  const site = (input.siteName ?? SITE_NAME).trim() || SITE_NAME
  const core = (input.displayTitle ?? '').trim() || '여행 상품'
  return `${core} | ${site}`
}
