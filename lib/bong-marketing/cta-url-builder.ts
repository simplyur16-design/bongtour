/**
 * 마케팅 CTA URL SSOT — `/products/{slug}` + UTM.
 */
import { isValidYearMonth } from '@/lib/monthly-curation'
import { absoluteUrl, getSiteOrigin } from '@/lib/site-metadata'

export type MarketingCtaChannel = 'naver_blog' | 'facebook' | 'instagram'

export type MarketingCtaPosition = 'header_cta' | 'mid_cta' | 'final_cta' | 'inline_cta'

export type BuildProductMarketingCtaUrlArgs = {
  slug: string | null | undefined
  /** YYYY-MM (utm_campaign 접두) */
  campaignMonthKey: string
  channel?: MarketingCtaChannel
  position?: MarketingCtaPosition
}

function resolveCampaignMonthKey(monthKey: string): string {
  const trimmed = monthKey.trim()
  if (isValidYearMonth(trimmed)) return trimmed
  const now = new Date()
  const seoul = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const y = seoul.getFullYear()
  const m = String(seoul.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/**
 * 상품 상세 CTA 상대 경로 (`/products/{slug}?utm_…`).
 * slug 없으면 `/` (홈).
 */
export function buildProductMarketingCtaRelativePath(args: BuildProductMarketingCtaUrlArgs): string {
  const slug = args.slug?.trim()
  if (!slug) return '/'

  const channel = args.channel ?? 'naver_blog'
  const position = args.position ?? 'final_cta'
  const campaignMonthKey = resolveCampaignMonthKey(args.campaignMonthKey)

  const params = new URLSearchParams()
  params.set('utm_source', channel)
  params.set('utm_medium', 'cta')
  params.set('utm_campaign', `${campaignMonthKey}-${slug}`)
  params.set('utm_content', position)

  return `/products/${slug}?${params.toString()}`
}

/** 절대 URL. slug 없으면 사이트 홈 origin만 반환. */
export function buildProductMarketingCtaAbsoluteUrl(args: BuildProductMarketingCtaUrlArgs): string {
  const slug = args.slug?.trim()
  if (!slug) return getSiteOrigin()
  return absoluteUrl(buildProductMarketingCtaRelativePath(args))
}

/** 블로그 본문 하단 상품 CTA 마크다운 블록 추가 */
export function appendBlogProductCtaMarkdown(md: string, ctaPathOrAbsoluteUrl: string): string {
  const url = ctaPathOrAbsoluteUrl.startsWith('http')
    ? ctaPathOrAbsoluteUrl
    : absoluteUrl(ctaPathOrAbsoluteUrl.startsWith('/') ? ctaPathOrAbsoluteUrl : `/${ctaPathOrAbsoluteUrl}`)
  const block = `\n\n---\n\n## 상품 보기\n봉투어에서 이 상품 일정과 조건을 확인해 보세요.\n\n[**상품 보기**](${url})\n`
  return `${md.trimEnd()}${block}`
}
