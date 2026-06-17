/**
 * 카드뉴스 카피 자동 생성 (Gemini 2.5 Pro).
 *
 * Episode 1편 → 시스템/유저 프롬프트 빌드 → Gemini 호출 → JSON 검증 → 5장 슬라이드 트랜잭션 저장.
 * 자동 발행/cron 없음 — 운영자 수동 트리거(API)에서만 호출.
 */
import { prisma } from '@/lib/prisma'
import {
  buildCardNewsSystemPrompt,
  buildCardNewsUserPrompt,
  expectedSlideRoles,
} from '@/lib/bong-marketing/card-news-prompt'
import { generateGeminiJsonResponse } from '@/lib/bong-marketing/gemini-generate'
import { buildPexelsKeyword } from '@/lib/bong-marketing/pexels-keyword-builder'
import { detectIdentityViolations } from '@/lib/bong-marketing/bongtour-brand-guide'
import { debugWarn } from '@/lib/bong-marketing/debug-log'

/** 카드뉴스는 Pro 모델 사용 (스펙 고정). env 로 덮어쓸 수 있음. */
const CARD_NEWS_MODEL = (process.env.CARD_NEWS_GEMINI_MODEL || 'gemini-2.5-pro').trim()

export const HEADLINE_MAX_LEN = 12
export const SUBTITLE_MAX_LEN = 15
export const BODY_MAX_LEN = 50

export interface CardNewsGenerationResult {
  episodeId: string
  slides: Array<{
    slideNumber: number
    slideRole: string
    headline: string
    subtitle?: string
    body?: string
    pexelsKeyword?: string
  }>
}

export interface NormalizedSlide {
  slideNumber: number
  slideRole: string
  headline: string
  subtitle: string | null
  body: string | null
  pexelsKeyword: string | null
}

export interface SlideValidationResult {
  slideNumber: number
  headlineValid: boolean
  subtitleValid: boolean
  bodyValid: boolean
}

interface RawSlide {
  slideNumber?: unknown
  slideRole?: unknown
  headline?: unknown
  subtitle?: unknown
  body?: unknown
  pexelsKeyword?: unknown
}

function asTrimmedString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function asNullableString(v: unknown): string | null {
  const s = asTrimmedString(v)
  return s || null
}

/**
 * 본문 자연스러운 자르기.
 * maxChars 이내면 그대로, 초과 시 마침표·줄바꿈·띄어쓰기 기준으로 자름.
 */
export function truncateBodyNaturally(body: string, maxChars: number = BODY_MAX_LEN): string {
  if (!body) return body
  if (body.length <= maxChars) return body

  const sentences = body.split(/(?<=[.!?])\s*/)
  let result = ''
  for (const sentence of sentences) {
    if ((result + sentence).length <= maxChars) {
      result += sentence
    } else {
      break
    }
  }
  if (result.length > 0) return result.trim()

  const words = body.split(/\s+/)
  result = ''
  for (const word of words) {
    if ((result + ' ' + word).trim().length <= maxChars) {
      result = (result + ' ' + word).trim()
    } else {
      break
    }
  }
  if (result.length > 0) return `${result}…`

  return body.slice(0, maxChars - 1) + '…'
}

/** 헤드라인·부제: maxChars 초과 시 문자 단위 자르기 (말줄임표 없음). */
export function truncateHeadline(headline: string, maxChars: number = HEADLINE_MAX_LEN): string {
  if (!headline) return headline
  if (headline.length <= maxChars) return headline
  return headline.slice(0, maxChars)
}

export function validateSlide(slide: {
  slideNumber: number
  headline: string
  subtitle: string | null
  body: string | null
}): SlideValidationResult {
  const headlineLen = slide.headline.length
  const subtitleLen = slide.subtitle ? slide.subtitle.length : 0
  const bodyLen = slide.body ? slide.body.length : 0

  return {
    slideNumber: slide.slideNumber,
    headlineValid: headlineLen > 0 && headlineLen <= HEADLINE_MAX_LEN,
    subtitleValid: subtitleLen === 0 || subtitleLen <= SUBTITLE_MAX_LEN,
    bodyValid: bodyLen === 0 || bodyLen <= BODY_MAX_LEN,
  }
}

export function buildSlideCorrectionPrompt(
  baseUserPrompt: string,
  invalid: SlideValidationResult[],
): string {
  const lines = invalid.map((v) => {
    const issues = [
      !v.headlineValid && '헤드라인 12자 이내 X',
      !v.subtitleValid && '부제 15자 이내 X',
      !v.bodyValid && '본문 50자 이내 X',
    ].filter(Boolean)
    return `슬라이드 ${v.slideNumber}: ${issues.join(', ')}`
  })
  return `${baseUserPrompt}\n\n[보정 요청]\n다음 슬라이드의 글자 수가 사양 위반입니다. 다시 생성하세요:\n${lines.join('\n')}`
}

export function enforceSlideCharLimits(slide: NormalizedSlide): NormalizedSlide {
  return {
    ...slide,
    headline: truncateHeadline(slide.headline, HEADLINE_MAX_LEN),
    subtitle: slide.subtitle ? truncateHeadline(slide.subtitle, SUBTITLE_MAX_LEN) : null,
    body: slide.body ? truncateBodyNaturally(slide.body, BODY_MAX_LEN) : null,
  }
}

function normalizeRawSlides(
  rawSlides: RawSlide[],
  roles: string[],
  fallbackCity: string,
  fallbackPlace: string | null,
  season: string | null,
): NormalizedSlide[] {
  return rawSlides.map((raw, idx) => {
    const headline = asTrimmedString(raw.headline)
    if (!headline) throw new Error(`Slide ${idx + 1} missing headline`)

    const slideNumber =
      typeof raw.slideNumber === 'number' && raw.slideNumber >= 1 && raw.slideNumber <= 5
        ? raw.slideNumber
        : idx + 1
    const slideRole = asTrimmedString(raw.slideRole) || roles[idx] || `slide${idx + 1}`
    const pexelsKeyword =
      asNullableString(raw.pexelsKeyword) ||
      buildPexelsKeyword(fallbackCity, fallbackPlace, season) ||
      null

    return {
      slideNumber,
      slideRole,
      headline,
      subtitle: asNullableString(raw.subtitle),
      body: asNullableString(raw.body),
      pexelsKeyword,
    }
  })
}

async function callGeminiForSlides(
  systemPrompt: string,
  userPrompt: string,
): Promise<RawSlide[]> {
  const response = await generateGeminiJsonResponse<{ slides?: RawSlide[] }>({
    model: CARD_NEWS_MODEL,
    systemPrompt,
    userPrompt,
    maxOutputTokens: 4096,
  })

  if (!response.slides || !Array.isArray(response.slides) || response.slides.length !== 5) {
    throw new Error(
      `Invalid response: expected 5 slides, got ${
        Array.isArray(response.slides) ? response.slides.length : 'none'
      }`,
    )
  }

  return response.slides
}

async function generateAndValidateSlides(
  systemPrompt: string,
  userPrompt: string,
  roles: string[],
  fallbackCity: string,
  fallbackPlace: string | null,
  season: string | null,
): Promise<NormalizedSlide[]> {
  let rawSlides = await callGeminiForSlides(systemPrompt, userPrompt)
  let normalized = normalizeRawSlides(rawSlides, roles, fallbackCity, fallbackPlace, season)

  let invalid = normalized
    .map(validateSlide)
    .filter((v) => !v.headlineValid || !v.subtitleValid || !v.bodyValid)

  if (invalid.length > 0) {
    const retryPrompt = buildSlideCorrectionPrompt(userPrompt, invalid)
    rawSlides = await callGeminiForSlides(systemPrompt, retryPrompt)
    normalized = normalizeRawSlides(rawSlides, roles, fallbackCity, fallbackPlace, season)
    invalid = normalized
      .map(validateSlide)
      .filter((v) => !v.headlineValid || !v.subtitleValid || !v.bodyValid)
  }

  if (invalid.length > 0) {
    debugWarn('card-news', 'slide char limits still invalid after retry; truncating', invalid)
    normalized = normalized.map(enforceSlideCharLimits)
  }

  return normalized
}

export function validateCardNewsBrandIdentity(slides: NormalizedSlide[]): void {
  const allText = slides
    .map((s) => [s.headline, s.subtitle, s.body].filter(Boolean).join(' '))
    .join(' ')
  const violations = detectIdentityViolations(allText)
  if (violations.length > 0) {
    debugWarn('brand-identity', '카드뉴스 정체성 위반 감지:', violations)
  }
}

/**
 * 단일 편의 카피를 생성하고 슬라이드를 저장한다.
 * 실패 시 throw (호출 측에서 시리즈/편 상태 롤백).
 */
export async function generateCardNewsEpisode(
  episodeId: string,
): Promise<CardNewsGenerationResult> {
  const episode = await prisma.bongCardNewsEpisode.findUnique({
    where: { id: episodeId },
    include: { series: true, linkedProduct: true },
  })
  if (!episode) throw new Error(`Episode ${episodeId} not found`)

  const operatorContext = await prisma.bongMarketingContext.findUnique({
    where: { weekKey: episode.series.weekKey },
  })

  const hooks = await prisma.bongHookLibrary.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    take: 60,
  })
  const goodHooks = hooks.filter((h) => h.hookType === 'good').slice(0, 10)
  const badHooks = hooks.filter((h) => h.hookType === 'bad').slice(0, 10)

  const trendContext = ''

  const episodeType = (episode.episodeType as 'package' | 'tip' | 'caution') ?? 'package'
  const formatType = (episode.formatType as 'deep' | 'list') ?? 'deep'

  const systemPrompt = buildCardNewsSystemPrompt()
  const userPrompt = buildCardNewsUserPrompt({
    themeTitle: episode.series.themeTitle,
    selectedCities: episode.series.selectedCities,
    tripNights: episode.series.tripNights,
    tripDays: episode.series.tripDays,
    season: episode.series.season,
    operatorContext: {
      themeIntent: operatorContext?.themeIntent ?? undefined,
      targetAudience: operatorContext?.targetAudience ?? undefined,
      hotInfo: operatorContext?.hotInfo ?? undefined,
      avoidTone: operatorContext?.avoidTone ?? undefined,
      customKeywords: operatorContext?.customKeywords ?? undefined,
    },
    episode: {
      episodeNumber: episode.episodeNumber,
      episodeType,
      formatType,
      title: episode.title,
      targetCity: episode.targetCity ?? undefined,
      targetPlace: episode.targetPlace ?? undefined,
      operatorNote: episode.operatorNote ?? undefined,
      linkedProduct: episode.linkedProduct
        ? {
            id: episode.linkedProduct.id,
            title: episode.linkedProduct.title,
            country: episode.linkedProduct.country ?? undefined,
            city: episode.linkedProduct.city ?? undefined,
          }
        : undefined,
    },
    hookLibrary: {
      good: goodHooks.map((h) => ({ hookText: h.hookText, context: h.context ?? undefined })),
      bad: badHooks.map((h) => ({ hookText: h.hookText, context: h.context ?? undefined })),
    },
    trendContext,
  })

  const roles = expectedSlideRoles(episodeType, formatType)
  const fallbackCity = episode.targetCity ?? episode.series.selectedCities[0] ?? ''
  const fallbackPlace = episode.targetPlace ?? null

  const normalized = await generateAndValidateSlides(
    systemPrompt,
    userPrompt,
    roles,
    fallbackCity,
    fallbackPlace,
    episode.series.season,
  )

  validateCardNewsBrandIdentity(normalized)

  await prisma.$transaction(async (tx) => {
    await tx.bongCardNewsSlide.deleteMany({ where: { episodeId } })
    for (const slide of normalized) {
      await tx.bongCardNewsSlide.create({
        data: {
          episodeId,
          slideNumber: slide.slideNumber,
          slideRole: slide.slideRole,
          headline: slide.headline,
          subtitle: slide.subtitle,
          body: slide.body,
          pexelsKeyword: slide.pexelsKeyword,
          status: 'draft',
        },
      })
    }
    await tx.bongCardNewsEpisode.update({
      where: { id: episodeId },
      data: { status: 'ready' },
    })
  })

  return {
    episodeId,
    slides: normalized.map((s) => ({
      slideNumber: s.slideNumber,
      slideRole: s.slideRole,
      headline: s.headline,
      subtitle: s.subtitle ?? undefined,
      body: s.body ?? undefined,
      pexelsKeyword: s.pexelsKeyword ?? undefined,
    })),
  }
}

/** 시리즈 내 모든 편을 순차 생성한다(편 단위 실패는 throw 로 전파). */
export async function generateCardNewsSeries(
  seriesId: string,
): Promise<CardNewsGenerationResult[]> {
  const episodes = await prisma.bongCardNewsEpisode.findMany({
    where: { seriesId },
    orderBy: { episodeNumber: 'asc' },
    select: { id: true },
  })
  if (!episodes.length) {
    throw new Error(`Series ${seriesId} has no episodes`)
  }

  const results: CardNewsGenerationResult[] = []
  for (const ep of episodes) {
    results.push(await generateCardNewsEpisode(ep.id))
  }

  await prisma.bongCardNewsSeries.update({
    where: { id: seriesId },
    data: { status: 'ready' },
  })

  return results
}
