/**
 * 마케팅 CTA URL SSOT — `/products/{slug}` + UTM.
 * 블로그 본문 하단 「바로가기」 마크다운 링크 생성·교체.
 */
// REGRESSION-FREEZE[marketing-blog-shortcut-cta]: 본문 바로가기 링크 라벨·upsert — manifest
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

/** 네이버 블로그·미리보기에서 클릭되는 CTA 링크 문구 */
export const BLOG_SHORTCUT_LINK_LABEL = '바로가기'

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

/** http(s) 절대 URL로 정규화. 실패 시 null. */
export function normalizeBlogShortcutAbsoluteUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  try {
    const withProto = /^https?:\/\//i.test(t) ? t : t.startsWith('/') ? absoluteUrl(t) : `https://${t}`
    const u = new URL(withProto)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

function buildBlogShortcutMarkdownBlock(absoluteUrlStr: string): string {
  return `\n\n---\n\n## ${BLOG_SHORTCUT_LINK_LABEL}\n봉투어에서 이 상품 일정과 조건을 확인해 보세요.\n\n[**${BLOG_SHORTCUT_LINK_LABEL}**](${absoluteUrlStr})\n`
}

/** 기존 상품 보기 / 바로가기 / 상담하기 CTA 블록 제거 후 본문만 반환 */
export function stripBlogProductCtaMarkdown(md: string): string {
  let out = md
  // trailing CTA blocks (legacy + current)
  out = out.replace(
    /\n*---\n+##\s*(바로가기|상품 보기|여행 상담)\n[\s\S]*?\[\*\*(?:바로가기|상품 보기|상담하기)\*\*\]\([^)]+\)\s*$/g,
    '',
  )
  // mid-body duplicates
  out = out.replace(
    /\n*---\n+##\s*(바로가기|상품 보기|여행 상담)\n[\s\S]*?\[\*\*(?:바로가기|상품 보기|상담하기)\*\*\]\([^)]+\)\s*/g,
    '\n\n',
  )
  return out.trimEnd()
}

/**
 * 블로그 본문 하단 「바로가기」 마크다운 블록 추가.
 * 기존 CTA가 있으면 제거 후 새로 붙임.
 */
export function appendBlogProductCtaMarkdown(md: string, ctaPathOrAbsoluteUrl: string): string {
  const url = normalizeBlogShortcutAbsoluteUrl(ctaPathOrAbsoluteUrl)
  if (!url) return md.trimEnd()
  const base = stripBlogProductCtaMarkdown(md)
  return `${base}${buildBlogShortcutMarkdownBlock(url)}`
}

/** 어드민: URL을 본문 바로가기로 upsert (상품 CTA·임의 URL 공통) */
export function upsertBlogShortcutMarkdown(md: string, ctaPathOrAbsoluteUrl: string): string {
  return appendBlogProductCtaMarkdown(md, ctaPathOrAbsoluteUrl)
}
