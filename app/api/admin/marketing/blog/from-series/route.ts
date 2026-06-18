import { NextResponse } from 'next/server'
import {
  BLOG_FROM_SERIES_PROMPT_VERSION,
  generateBlogPostFromSeries,
  type BlogContentTrack,
} from '@/lib/bong-marketing/blog-generator'
import { appendBlogProductCtaMarkdown } from '@/lib/bong-marketing/cta-url-builder'
import { extractProductGeoMeta } from '@/lib/bong-marketing/product-extractor'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

export const maxDuration = 300

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
 * POST /api/admin/marketing/blog/from-series
 * 카드뉴스 시리즈 전 편 통합 → Gemini 블로그 8단락 생성 → BongBlogPost draft INSERT
 */
export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const body = await readJson(req)
  if (!body) return NextResponse.json({ error: 'JSON body 필수' }, { status: 400 })

  const seriesId = typeof body.seriesId === 'string' ? body.seriesId.trim() : ''
  const contentTrack =
    typeof body.contentTrack === 'string' && VALID_TRACKS.includes(body.contentTrack as BlogContentTrack)
      ? (body.contentTrack as BlogContentTrack)
      : null

  if (!seriesId) return NextResponse.json({ error: 'seriesId 필수' }, { status: 400 })
  if (!contentTrack) {
    return NextResponse.json({ error: 'contentTrack must be package or airtel' }, { status: 400 })
  }

  try {
    const series = await prisma.bongCardNewsSeries.findUnique({
      where: { id: seriesId },
      include: {
        episodes: {
          orderBy: { episodeNumber: 'asc' },
          include: { linkedProduct: { select: { id: true, country: true } } },
        },
      },
    })

    if (!series) {
      return NextResponse.json({ error: '시리즈 없음' }, { status: 404 })
    }

    const generated = await generateBlogPostFromSeries({ seriesId, contentTrack })

    const firstCity = series.selectedCities[0] || ''
    const packageEpisode = series.episodes.find((ep) => ep.episodeType === 'package')
    const linkedProductId = packageEpisode?.linkedProductId ?? series.episodes[0]?.linkedProductId ?? null
    const country = packageEpisode?.linkedProduct?.country ?? series.episodes[0]?.linkedProduct?.country ?? ''

    const monthKey = getCurrentMonthKey()
    let body = generated.body
    if (linkedProductId) {
      try {
        const geo = await extractProductGeoMeta(linkedProductId, {
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
        citySlug: slugify(firstCity) || null,
        countrySlug: slugify(country) || null,
        linkedProductId,
        season: series.season || null,
        tripNights: series.tripNights ?? null,
        tripDays: series.tripDays ?? null,
        linkedCardNewsSeriesId: seriesId,
        generationModel: 'gemini-2.5-pro',
        generationPromptVersion: BLOG_FROM_SERIES_PROMPT_VERSION,
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
