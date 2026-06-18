import { NextResponse } from 'next/server'
import {
  BLOG_GENERATION_PROMPT_VERSION,
  generateBlogPost,
  type BlogContentTrack,
} from '@/lib/bong-marketing/blog-generator'
import { appendBlogProductCtaMarkdown } from '@/lib/bong-marketing/cta-url-builder'
import { extractProductGeoMeta } from '@/lib/bong-marketing/product-extractor'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

export const maxDuration = 300

const VALID_SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const
const VALID_TRACKS: BlogContentTrack[] = ['package', 'airtel']

function getCurrentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await req.json()
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * POST /api/admin/marketing/blog/from-recommendation
 * 시즌 추천 카드 → Gemini 블로그 글 생성 → BongBlogPost draft INSERT
 */
export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const body = await readJson(req)
  if (!body) return NextResponse.json({ error: 'JSON body 필수' }, { status: 400 })

  const city = typeof body.city === 'string' ? body.city.trim() : ''
  const country = typeof body.country === 'string' ? body.country.trim() : ''
  const season =
    typeof body.season === 'string' && (VALID_SEASONS as readonly string[]).includes(body.season)
      ? body.season
      : null
  const monthRange = typeof body.monthRange === 'string' ? body.monthRange.trim() : ''
  const urgency = typeof body.urgency === 'string' ? body.urgency.trim() : ''
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  const themes = Array.isArray(body.themes)
    ? body.themes.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    : undefined
  const contentTrack =
    typeof body.contentTrack === 'string' && VALID_TRACKS.includes(body.contentTrack as BlogContentTrack)
      ? (body.contentTrack as BlogContentTrack)
      : null

  if (!city) return NextResponse.json({ error: 'city 필수' }, { status: 400 })
  if (!season) return NextResponse.json({ error: 'season 필수' }, { status: 400 })
  if (!contentTrack) {
    return NextResponse.json({ error: 'contentTrack must be package or airtel' }, { status: 400 })
  }

  const recommendedTripNights =
    typeof body.recommendedTripNights === 'number' && body.recommendedTripNights > 0
      ? Math.floor(body.recommendedTripNights)
      : undefined
  const recommendedTripDays =
    typeof body.recommendedTripDays === 'number' && body.recommendedTripDays > 0
      ? Math.floor(body.recommendedTripDays)
      : undefined

  const matchingProductIds = Array.isArray(body.matchingProductIds)
    ? body.matchingProductIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : []

  let firstProductId: string | null = matchingProductIds[0] ?? null
  if (firstProductId) {
    const product = await prisma.product.findUnique({ where: { id: firstProductId }, select: { id: true } })
    if (!product) firstProductId = null
  }

  try {
    const generated = await generateBlogPost({
      city,
      country,
      season: season as 'spring' | 'summer' | 'autumn' | 'winter',
      monthRange,
      urgency,
      reason,
      themes,
      recommendedTripNights,
      recommendedTripDays,
      matchingProductIds,
      contentTrack,
    })

    const monthKey = getCurrentMonthKey()
    let body = generated.body
    if (firstProductId) {
      try {
        const geo = await extractProductGeoMeta(firstProductId, {
          utmSource: 'naver_blog',
          utmContent: 'final_cta',
          campaignMonthKey: monthKey,
        })
        if (geo.productSlug) {
          body = appendBlogProductCtaMarkdown(body, geo.ctaUrl)
        }
      } catch {
        /* CTA 없이 본문만 저장 */
      }
    }

    const blogPost = await prisma.bongBlogPost.create({
      data: {
        title: generated.title,
        excerpt: generated.excerpt || null,
        body,
        hashtags: generated.hashtags,
        contentTrack,
        status: 'draft',
        monthKey,
        citySlug: slugify(city) || null,
        countrySlug: slugify(country) || null,
        linkedProductId: firstProductId,
        season,
        tripNights: recommendedTripNights ?? null,
        tripDays: recommendedTripDays ?? null,
        recommendationMeta: {
          monthRange,
          urgency,
          reason,
          themes: themes ?? [],
          matchingProductIds,
          city,
          country,
        },
        generationModel: 'gemini-2.5-pro',
        generationPromptVersion: BLOG_GENERATION_PROMPT_VERSION,
      },
    })

    const redirectTo =
      contentTrack === 'package'
        ? `/admin/marketing/packages/${blogPost.id}`
        : `/admin/marketing/airtel/${blogPost.id}`

    return NextResponse.json({
      blogPostId: blogPost.id,
      contentTrack,
      redirectTo,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '블로그 글 생성 실패' },
      { status: 500 },
    )
  }
}
