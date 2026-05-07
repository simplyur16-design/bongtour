/**
 * B-4-2: 패키지 상품 → 네이버 블로그 초안 (Gemini + BongBlogPost draft).
 * SSOT: 상담 CTA·UTM은 `extractProductGeoMeta` / `buildProductMarketingInquiryHref` (B-4-1).
 */
import type { Prisma, PrismaClient } from '@prisma/client'
import {
  extractProductGeoMeta,
  listProductsForMarketingMonth,
  type ListProductsForMarketingMonthOptions,
} from '@/lib/bong-marketing/product-extractor'
import {
  PACKAGE_BLOG_PROMPT_V1,
  PACKAGE_BLOG_PROMPT_VERSION,
  buildPackageBlogUserJson,
  type PackageBlogLlmPayload,
  type PackageBlogLlmV1,
} from '@/lib/bong-marketing/blog-draft-prompt'
import { parseGeminiJsonOutput } from '@/lib/bong-marketing/gemini-json-parse'
import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import { absoluteUrl } from '@/lib/site-metadata'
import { isValidYearMonth } from '@/lib/monthly-curation'

const SCHEDULE_EXCERPT_MAX = 8000
const EXCERPT_DB_MAX = 500

export type GenerateNaverBlogDraftForPackageOptions = {
  /** DB에 초안 저장 (기본 true). 로컴 검증 시 false 로 Gemini·파싱만 확인 */
  persist?: boolean
  /** 기본 true: 동일 상품·월에 draft 가 있으면 스킵 */
  skipIfDraftExists?: boolean
  /** 기본 true: productType 에 '자유' 포함 시 제외 (B-4-3 예약) */
  packageOnly?: boolean
  /** 비우면 GEMINI_MODEL / getModelName() */
  geminiModel?: string
}

export type GenerateNaverBlogDraftOk = {
  ok: true
  blogPostId?: string
  title: string
  excerpt: string | null
  bodyWithCta: string
  photoSpots: string[]
  inquiryPath: string
  persisted: boolean
  generationModel: string
  /** 성공 시 적용된 Gemini JSON 추출 전략 (검증·모니터링용) */
  geminiJsonParseStrategy?: 'raw' | 'fenced' | 'braces' | 'comma_clean'
}

export type GenerateNaverBlogDraftErr = {
  ok: false
  code:
    | 'INVALID_MONTH'
    | 'NOT_FOUND'
    | 'GEMINI_KEY'
    | 'GEMINI_FAIL'
    | 'PARSE_FAIL'
    | 'DRAFT_EXISTS'
    | 'PACKAGE_ONLY_SKIP'
  error: string
  existingDraftId?: string
  /** PARSE_FAIL 시 디버깅용 원문 앞부분 */
  geminiRawPreview?: string
}

export type GenerateNaverBlogDraftResult = GenerateNaverBlogDraftOk | GenerateNaverBlogDraftErr

export type GenerateMonthBlogDraftsForPackagesOptions = {
  persist?: boolean
  skipIfDraftExists?: boolean
  packageOnly?: boolean
  geminiModel?: string
  listOptions?: ListProductsForMarketingMonthOptions
}

export type GenerateMonthBlogDraftsReport = {
  monthKey: string
  attempted: number
  succeeded: number
  skipped: Array<{ productId: string; code: string; message: string }>
  blogPostIds: string[]
}

function packageBlogFromParsedJson(value: unknown): PackageBlogLlmV1 {
  if (!value || typeof value !== 'object') throw new Error('JSON root must be object')
  const o = value as Record<string, unknown>
  const title = typeof o.title === 'string' ? o.title.trim() : ''
  const body = typeof o.body === 'string' ? o.body.trim() : ''
  if (!title || !body) throw new Error('title/body 필수')
  const excerptRaw = typeof o.excerpt === 'string' ? o.excerpt.trim() : ''
  const excerpt = excerptRaw || body.replace(/\s+/g, ' ').slice(0, 200)
  const psRaw = Array.isArray(o.photoSpots) ? o.photoSpots : []
  const photoSpots = psRaw
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 3)
  return { title, body, excerpt, photoSpots }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

function scheduleExcerptFromRaw(schedule: string | null | undefined): string | null {
  const raw = (schedule ?? '').trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      const lines = parsed
        .slice(0, 12)
        .map((row) => {
          if (!row || typeof row !== 'object') return ''
          const r = row as Record<string, unknown>
          const day = r.day != null ? String(r.day) : ''
          const title = typeof r.title === 'string' ? r.title : ''
          const desc = typeof r.description === 'string' ? r.description : ''
          return [day && `Day ${day}`, title, desc].filter(Boolean).join(' — ')
        })
        .filter(Boolean)
      const t = lines.join('\n')
      return t.length ? truncate(t, SCHEDULE_EXCERPT_MAX) : truncate(raw, SCHEDULE_EXCERPT_MAX)
    }
  } catch {
    /* ignore */
  }
  return truncate(raw, SCHEDULE_EXCERPT_MAX)
}

function appendPackageInquiryCta(md: string, inquiryRelativePath: string): string {
  const url = absoluteUrl(inquiryRelativePath.startsWith('/') ? inquiryRelativePath : `/${inquiryRelativePath}`)
  const block = `\n\n---\n\n## 여행 상담\n봉투어에서 이 상품 일정과 조건을 확인하고 **무료 상담**을 신청해 보세요.\n\n[**상담하기**](${url})\n`
  return `${md.trimEnd()}${block}`
}

async function loadProductBlogContext(
  prisma: PrismaClient,
  productId: string,
): Promise<{
  row: {
    title: string
    summary: string | null
    benefitSummary: string | null
    duration: string | null
    tripDays: number | null
    tripNights: number | null
    productType: string | null
    schedule: string | null
    country: string | null
    city: string | null
    countryKey: string | null
    cityKey: string | null
  }
  spots: Array<{ title: string; summary: string | null }>
  tips: Array<{ title: string; body: string | null }>
} | null> {
  const row = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      title: true,
      summary: true,
      benefitSummary: true,
      duration: true,
      tripDays: true,
      tripNights: true,
      productType: true,
      schedule: true,
      country: true,
      city: true,
      countryKey: true,
      cityKey: true,
    },
  })
  if (!row) return null

  const spotRows = await prisma.productBongSpot.findMany({
    where: { productId },
    take: 6,
    include: { bongSpot: { select: { title: true, summary: true } } },
  })
  const spots = spotRows
    .map((x) => x.bongSpot)
    .filter(Boolean)
    .map((s) => ({ title: s.title.trim(), summary: s.summary?.trim() ?? null }))

  const tipOr: Prisma.BongTipWhereInput[] = []
  if (row.countryKey) {
    if (row.cityKey) {
      tipOr.push({ countryKey: row.countryKey, cityKey: row.cityKey })
    }
    tipOr.push({ countryKey: row.countryKey, cityKey: null })
  }

  const tips =
    tipOr.length > 0
      ? await prisma.bongTip.findMany({
          where: {
            OR: tipOr,
            status: { in: ['draft', 'approved', 'published'] },
          },
          select: { title: true, body: true },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        })
      : []

  return {
    row,
    spots,
    tips: tips.map((t) => ({ title: t.title.trim(), body: t.body?.trim() ?? null })),
  }
}

export async function generateNaverBlogDraftForPackage(
  prisma: PrismaClient,
  productId: string,
  monthKey: string,
  options?: GenerateNaverBlogDraftForPackageOptions,
): Promise<GenerateNaverBlogDraftResult> {
  const mk = monthKey.trim()
  if (!isValidYearMonth(mk)) {
    return { ok: false, code: 'INVALID_MONTH', error: `monthKey 형식 오류: ${monthKey}` }
  }

  const persist = options?.persist !== false
  /** DB 저장 시에만 기본으로 중복 draft 방지. dry-run(persist false)은 매번 Gemini 호출 */
  const skipIfDraftExists =
    options?.skipIfDraftExists !== undefined ? options.skipIfDraftExists : persist
  const packageOnly = options?.packageOnly !== false

  if (skipIfDraftExists) {
    const dup = await prisma.bongBlogPost.findFirst({
      where: { linkedProductId: productId, monthKey: mk, status: 'draft' },
      select: { id: true },
    })
    if (dup) {
      return {
        ok: false,
        code: 'DRAFT_EXISTS',
        error: `이미 draft 초안이 있습니다: ${dup.id}`,
        existingDraftId: dup.id,
      }
    }
  }

  const ctx = await loadProductBlogContext(prisma, productId)
  if (!ctx) {
    return { ok: false, code: 'NOT_FOUND', error: `Product not found: ${productId}` }
  }

  if (packageOnly && ctx.row.productType && /자유/.test(ctx.row.productType)) {
    return {
      ok: false,
      code: 'PACKAGE_ONLY_SKIP',
      error: '자유여행 상품은 B-4-2 대상에서 제외됩니다.',
    }
  }

  const geo = await extractProductGeoMeta(productId, {
    utmSource: 'naver_blog',
    utmContent: 'final_cta',
    campaignMonthKey: mk,
  })

  const payload: PackageBlogLlmPayload = {
    geo,
    product: {
      title: ctx.row.title,
      summary: ctx.row.summary,
      benefitSummary: ctx.row.benefitSummary,
      duration: ctx.row.duration,
      tripDays: ctx.row.tripDays,
      tripNights: ctx.row.tripNights,
      productType: ctx.row.productType,
      scheduleExcerpt: scheduleExcerptFromRaw(ctx.row.schedule),
    },
    bongSpots: ctx.spots,
    bongTips: ctx.tips,
  }

  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!apiKey) {
    return { ok: false, code: 'GEMINI_KEY', error: 'GEMINI_API_KEY(또는 GOOGLE_API_KEY) 미설정' }
  }

  const modelId = (options?.geminiModel?.trim() || getModelName()).trim()
  const model = getGenAI().getGenerativeModel({ model: modelId })
  const userText = `${PACKAGE_BLOG_PROMPT_V1}\n\n## 입력(JSON)\n${buildPackageBlogUserJson(payload)}`

  let parsed!: PackageBlogLlmV1
  let geminiJsonParseStrategy!: NonNullable<GenerateNaverBlogDraftOk['geminiJsonParseStrategy']>
  let lastRawText = ''

  for (let attempt = 1; attempt <= 2; attempt++) {
    const temperature = attempt === 1 ? 0.72 : 0.68
    let text: string
    try {
      const result = await model.generateContent(
        {
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: 8192,
            ...( { responseMimeType: 'application/json' } as { responseMimeType?: string }),
          },
        },
        geminiTimeoutOpts(120_000),
      )
      text = result.response.text()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, code: 'GEMINI_FAIL', error: msg }
    }

    lastRawText = text
    const pj = parseGeminiJsonOutput(text)

    if (!pj.ok) {
      console.warn(productId, attempt, pj.strategy, pj.errorReason)
      if (attempt === 2) {
        return {
          ok: false,
          code: 'PARSE_FAIL',
          error: `gemini_parse_failed_after_retry: ${pj.error}`,
          geminiRawPreview: lastRawText.slice(0, 500),
        }
      }
      continue
    }

    try {
      parsed = packageBlogFromParsedJson(pj.value)
      geminiJsonParseStrategy = pj.strategy
      break
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(productId, attempt, pj.strategy, msg)
      if (attempt === 2) {
        return {
          ok: false,
          code: 'PARSE_FAIL',
          error: `gemini_parse_failed_after_retry: ${msg}`,
          geminiRawPreview: lastRawText.slice(0, 500),
        }
      }
    }
  }

  const inquiryPath = geo.inquiryUrl.startsWith('/') ? geo.inquiryUrl : `/${geo.inquiryUrl}`
  const bodyWithCta = appendPackageInquiryCta(parsed.body, inquiryPath)
  const excerptDb = truncate(parsed.excerpt.replace(/\s+/g, ' ').trim(), EXCERPT_DB_MAX)

  if (!persist) {
    return {
      ok: true,
      title: parsed.title,
      excerpt: excerptDb,
      bodyWithCta,
      photoSpots: parsed.photoSpots,
      inquiryPath,
      persisted: false,
      generationModel: modelId,
      geminiJsonParseStrategy,
    }
  }

  const created = await prisma.bongBlogPost.create({
    data: {
      title: truncate(parsed.title, 200),
      excerpt: excerptDb,
      body: bodyWithCta,
      status: 'draft',
      linkedProductId: productId,
      monthKey: mk,
      citySlug: ctx.row.city?.trim() || null,
      countrySlug: ctx.row.country?.trim() || null,
      generationModel: modelId,
      generationPromptVersion: PACKAGE_BLOG_PROMPT_VERSION,
    },
  })

  return {
    ok: true,
    blogPostId: created.id,
    title: created.title,
    excerpt: created.excerpt,
    bodyWithCta,
    photoSpots: parsed.photoSpots,
    inquiryPath,
    persisted: true,
    generationModel: modelId,
    geminiJsonParseStrategy,
  }
}

export async function generateMonthBlogDraftsForPackages(
  prisma: PrismaClient,
  monthKey: string,
  options?: GenerateMonthBlogDraftsForPackagesOptions,
): Promise<GenerateMonthBlogDraftsReport> {
  const mk = monthKey.trim()
  if (!isValidYearMonth(mk)) {
    return {
      monthKey: mk,
      attempted: 0,
      succeeded: 0,
      skipped: [{ productId: '_', code: 'INVALID_MONTH', message: `monthKey 형식 오류: ${monthKey}` }],
      blogPostIds: [],
    }
  }

  const candidates = await listProductsForMarketingMonth(mk, options?.listOptions)
  const ids = candidates.map((c) => c.productId)
  const types = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, productType: true },
  })
  const typeById = new Map(types.map((t) => [t.id, t.productType]))

  const skipped: Array<{ productId: string; code: string; message: string }> = []
  const blogPostIds: string[] = []
  let succeeded = 0

  const packageOnly = options?.packageOnly !== false
  const pool: typeof candidates = []
  for (const c of candidates) {
    const pt = typeById.get(c.productId)
    if (packageOnly && pt && /자유/.test(pt)) {
      skipped.push({ productId: c.productId, code: 'PACKAGE_ONLY_SKIP', message: '자유여행 제외' })
      continue
    }
    pool.push(c)
  }

  const persist = options?.persist !== false
  const skipDup =
    options?.skipIfDraftExists !== undefined ? options.skipIfDraftExists : persist

  for (const c of pool) {
    const r = await generateNaverBlogDraftForPackage(prisma, c.productId, mk, {
      persist,
      skipIfDraftExists: skipDup,
      packageOnly: false,
      geminiModel: options?.geminiModel,
    })
    if (!r.ok) {
      skipped.push({ productId: c.productId, code: r.code, message: r.error })
      continue
    }
    succeeded += 1
    if (r.blogPostId) blogPostIds.push(r.blogPostId)
  }

  return {
    monthKey: mk,
    attempted: pool.length,
    succeeded,
    skipped,
    blogPostIds,
  }
}
