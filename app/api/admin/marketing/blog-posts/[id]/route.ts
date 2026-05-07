import { NextResponse } from 'next/server'
import type { BongContentStatus } from '@prisma/client'
import { generateNaverBlogDraftForPackage } from '@/lib/bong-marketing/blog-draft-generator'
import { PACKAGE_BLOG_PROMPT_VERSION } from '@/lib/bong-marketing/blog-draft-prompt'
import { extractProductGeoMeta } from '@/lib/bong-marketing/product-extractor'
import { isValidYearMonth } from '@/lib/monthly-curation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { absoluteUrl } from '@/lib/site-metadata'

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function reviewerLabel(session: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>): string {
  const u = session.user as { email?: string | null; id?: string | null }
  return (u.email?.trim() || u.id?.trim() || 'admin') as string
}

/**
 * GET /api/admin/marketing/blog-posts/:id
 */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await context.params
  const post = await prisma.bongBlogPost.findUnique({
    where: { id },
    include: {
      linkedProduct: { select: { id: true, title: true } },
    },
  })
  if (!post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let inquiryAbsoluteUrl: string | null = null
  if (post.linkedProductId && post.monthKey && isValidYearMonth(post.monthKey)) {
    try {
      const geo = await extractProductGeoMeta(post.linkedProductId, {
        utmSource: 'naver_blog',
        utmContent: 'final_cta',
        campaignMonthKey: post.monthKey,
      })
      const path = geo.inquiryUrl.startsWith('/') ? geo.inquiryUrl : `/${geo.inquiryUrl}`
      inquiryAbsoluteUrl = absoluteUrl(path)
    } catch {
      inquiryAbsoluteUrl = null
    }
  }

  return NextResponse.json({
    ...post,
    inquiryAbsoluteUrl,
    productTitle: post.linkedProduct?.title ?? null,
  })
}

type PatchAction = 'approve' | 'reject' | 'regenerate' | 'edit' | 'schedule' | 'publish'

/**
 * PATCH /api/admin/marketing/blog-posts/:id
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await context.params
  const rawBody = await readJson(request)
  const body = rawBody && typeof rawBody === 'object' ? (rawBody as Record<string, unknown>) : null
  if (!body) {
    return NextResponse.json({ error: 'JSON body 필수' }, { status: 400 })
  }
  const action = typeof body.action === 'string' ? (body.action as PatchAction) : null
  if (!action) {
    return NextResponse.json({ error: 'action 필수' }, { status: 400 })
  }

  const existing = await prisma.bongBlogPost.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const now = new Date()
  const reviewer = reviewerLabel(session)

  try {
    switch (action) {
      case 'approve': {
        const updated = await prisma.bongBlogPost.update({
          where: { id },
          data: {
            status: 'approved' satisfies BongContentStatus,
            reviewedAt: now,
            reviewedBy: reviewer,
            rejectedReason: null,
          },
        })
        return NextResponse.json({ ok: true, post: updated })
      }
      case 'reject': {
        const reason = typeof body.rejectedReason === 'string' ? body.rejectedReason.trim() : ''
        if (!reason) {
          return NextResponse.json({ error: 'rejectedReason 필수' }, { status: 400 })
        }
        const updated = await prisma.bongBlogPost.update({
          where: { id },
          data: {
            status: 'rejected' satisfies BongContentStatus,
            rejectedReason: reason,
            reviewedAt: now,
            reviewedBy: reviewer,
          },
        })
        return NextResponse.json({ ok: true, post: updated })
      }
      case 'schedule': {
        const raw = typeof body.scheduledAt === 'string' ? body.scheduledAt.trim() : ''
        const when = raw ? new Date(raw) : null
        if (!when || Number.isNaN(when.getTime())) {
          return NextResponse.json({ error: 'scheduledAt ISO 날짜 필수' }, { status: 400 })
        }
        const updated = await prisma.bongBlogPost.update({
          where: { id },
          data: {
            status: 'scheduled' satisfies BongContentStatus,
            scheduledAt: when,
          },
        })
        return NextResponse.json({ ok: true, post: updated })
      }
      case 'publish': {
        const updated = await prisma.bongBlogPost.update({
          where: { id },
          data: {
            status: 'published' satisfies BongContentStatus,
            publishedAt: now,
          },
        })
        return NextResponse.json({ ok: true, post: updated })
      }
      case 'edit': {
        const data: {
          title?: string
          excerpt?: string | null
          body?: string | null
        } = {}
        if (typeof body.title === 'string') data.title = truncate(body.title.trim(), 200)
        if (body.excerpt === null || typeof body.excerpt === 'string') {
          data.excerpt = body.excerpt === null ? null : body.excerpt.trim() || null
        }
        if (body.body === null || typeof body.body === 'string') {
          data.body = body.body === null ? null : body.body
        }
        if (Object.keys(data).length === 0) {
          return NextResponse.json({ error: 'title | excerpt | body 중 하나 이상 필요' }, { status: 400 })
        }
        const updated = await prisma.bongBlogPost.update({
          where: { id },
          data,
        })
        return NextResponse.json({ ok: true, post: updated })
      }
      case 'regenerate': {
        if (!existing.linkedProductId || !existing.monthKey || !isValidYearMonth(existing.monthKey)) {
          return NextResponse.json(
            { error: 'linkedProductId·monthKey 가 있어야 재생성할 수 있습니다.' },
            { status: 400 },
          )
        }
        const packageOnly = existing.contentTrack === 'package'
        const r = await generateNaverBlogDraftForPackage(
          prisma,
          existing.linkedProductId,
          existing.monthKey,
          {
            persist: false,
            skipIfDraftExists: false,
            packageOnly,
          },
        )
        if (!r.ok) {
          return NextResponse.json(
            { error: r.error, code: r.code },
            { status: r.code === 'GEMINI_KEY' || r.code === 'GEMINI_FAIL' ? 502 : 400 },
          )
        }
        const excerptDb = (r.excerpt ?? '').replace(/\s+/g, ' ').trim()
        const updated = await prisma.bongBlogPost.update({
          where: { id },
          data: {
            title: truncate(r.title, 200),
            excerpt: excerptDb.length > 500 ? truncate(excerptDb, 500) : excerptDb,
            body: r.bodyWithCta,
            generationModel: r.generationModel,
            generationPromptVersion: PACKAGE_BLOG_PROMPT_VERSION,
            status: 'draft',
            rejectedReason: null,
            reviewedAt: null,
            reviewedBy: null,
            scheduledAt: null,
          },
        })
        return NextResponse.json({ ok: true, post: updated })
      }
      default:
        return NextResponse.json({ error: 'unknown action' }, { status: 400 })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/marketing/blog-posts/:id — draft·rejected 만
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session?.user) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await context.params
  const existing = await prisma.bongBlogPost.findUnique({
    where: { id },
    select: { id: true, status: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (existing.status !== 'draft' && existing.status !== 'rejected') {
    return NextResponse.json({ error: 'draft 또는 rejected 상태만 삭제할 수 있습니다.' }, { status: 400 })
  }

  await prisma.bongBlogPost.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
