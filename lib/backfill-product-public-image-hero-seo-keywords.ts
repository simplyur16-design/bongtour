/**
 * 기존 Product + (선택) RegisterAdminAnalysis / RegisterAdminInputSnapshot 으로
 * `publicImageHeroSeoKeywordsJson` 후보를 만들기 위한 입력 조립 전용.
 * 스크래퍼·어댑터·parseForRegister* 와 무관.
 */

import { getScheduleFromProduct } from './schedule-from-product'
import {
  buildRegisterPublicImageHeroSeoKeywords,
  type RegisterPublicImageHeroSeoLineCandidateInput,
} from './register-public-image-hero-seo-line-candidate'

/** 스크립트·관리자 배치에서 Prisma `select` 결과에 맞춘 최소 필드 */
export type BackfillHeroSeoProductRow = {
  id: string
  originSource: string
  title: string
  primaryDestination: string | null
  destination: string | null
  destinationRaw: string | null
  duration: string | null
  tripNights: number | null
  tripDays: number | null
  summary: string | null
  benefitSummary: string | null
  themeTags: string | null
  themeLabelsRaw: string | null
  primaryRegion: string | null
  includedText: string | null
  excludedText: string | null
  optionalTourSummaryRaw: string | null
  schedule: string | null
  rawMeta: string | null
  itineraries?: ReadonlyArray<{ day: number; description: string }>
}

export type BackfillHeroSeoAnalysisRow = {
  normalizedJson: string | null
  parsedJson: string | null
  snapshot: { bodyText: string } | null
}

/** 1순위: Product 구조화 필드만으로도 기간 문자열을 복원 */
export function effectiveDurationForHeroSeoBackfill(
  p: Pick<BackfillHeroSeoProductRow, 'duration' | 'tripNights' | 'tripDays'>
): string | null {
  const d = (p.duration ?? '').trim()
  if (d) return d
  const n = p.tripNights
  const days = p.tripDays
  if (
    n != null &&
    days != null &&
    Number.isFinite(n) &&
    Number.isFinite(days) &&
    n >= 1 &&
    days >= 2
  ) {
    return `${Math.floor(n)}박${Math.floor(days)}일`
  }
  return null
}

function scheduleDayTitlesForBackfill(product: BackfillHeroSeoProductRow): string[] {
  const rows = getScheduleFromProduct({
    schedule: product.schedule,
    itineraries: product.itineraries ? [...product.itineraries] : undefined,
  })
  const out: string[] = []
  for (const s of rows) {
    const title = (s.title ?? '').trim()
    if (title) {
      out.push(title.slice(0, 90))
      continue
    }
    const desc = (s.description ?? '').replace(/\s+/g, ' ').trim()
    if (desc) out.push(desc.slice(0, 90))
  }
  return out.slice(0, 16)
}

/** 일정 `imageKeyword` — 대표 SEO 키워드 4순위 보조만(주원료 금지). */
function scheduleImageKeywordsForBackfill(product: BackfillHeroSeoProductRow): string[] {
  const rows = getScheduleFromProduct({
    schedule: product.schedule,
    itineraries: product.itineraries ? [...product.itineraries] : undefined,
  })
  const out: string[] = []
  const seen = new Set<string>()
  for (const s of rows) {
    const ik = typeof s.imageKeyword === 'string' ? s.imageKeyword.replace(/\s+/g, ' ').trim() : ''
    if (!ik || ik.length < 2) continue
    const k = ik.replace(/\s/g, '')
    if (seen.has(k)) continue
    seen.add(k)
    out.push(ik.slice(0, 40))
    if (out.length >= 14) break
  }
  return out
}

/**
 * 2순위 보조: 분석 JSON 상단의 짧은 문자열 필드만 수집(전체 구조 의존 금지).
 * 키워드 스캐너가 라인 단위로 오염·길이 필터를 적용한다.
 */
function harvestAnalysisSupplementText(normalizedJson: string | null, parsedJson: string | null): string {
  const parts: string[] = []
  const keyHint = /^(summary|benefitSummary|themeLabelsRaw|themeTags|primaryRegion|cardBenefitSummaryShort|promotionLabelsRaw|detailHeadline|productHighlight)$/i

  for (const raw of [normalizedJson, parsedJson]) {
    if (!raw?.trim()) continue
    try {
      const o = JSON.parse(raw) as unknown
      if (!o || typeof o !== 'object' || Array.isArray(o)) continue
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        if (!keyHint.test(k)) continue
        if (typeof v !== 'string') continue
        const t = v.trim()
        if (t.length >= 4 && t.length <= 800) parts.push(t.slice(0, 800))
      }
    } catch {
      /* skip */
    }
  }
  return parts.join('\n').slice(0, 3200)
}

/**
 * 원료 우선순위(고정):
 * 1) Product 필드 — title·목적지·기간·요약·혜택·테마·포함/불포함·rawMeta 앞부분
 * 2) RegisterAdminAnalysis JSON 문자열 + snapshot.bodyText 앞부분(보조)
 * 대표 SEO 키워드 조합은 `buildRegisterPublicImageHeroSeoKeywords` 우선순위를 따르며,
 * 일정 제목은 SEO 주원료에 쓰이지 않고, 일정 `imageKeyword` 는 4순위 보조로만 전달된다.
 */
export function buildRegisterHeroSeoInputFromBackfillRow(
  product: BackfillHeroSeoProductRow,
  analysis?: BackfillHeroSeoAnalysisRow | null
): RegisterPublicImageHeroSeoLineCandidateInput {
  const rawBodyChunks: string[] = []
  if (product.summary?.trim()) rawBodyChunks.push(product.summary.trim().slice(0, 900))
  if (product.benefitSummary?.trim()) rawBodyChunks.push(product.benefitSummary.trim().slice(0, 500))
  if (product.includedText?.trim()) rawBodyChunks.push(product.includedText.trim().slice(0, 700))
  if (product.excludedText?.trim()) rawBodyChunks.push(product.excludedText.trim().slice(0, 500))
  if (product.rawMeta?.trim()) rawBodyChunks.push(product.rawMeta.trim().slice(0, 1200))

  const analysisHay = harvestAnalysisSupplementText(
    analysis?.normalizedJson ?? null,
    analysis?.parsedJson ?? null
  )
  if (analysisHay) rawBodyChunks.push(analysisHay)

  const snap = analysis?.snapshot?.bodyText?.trim()
  if (snap) rawBodyChunks.push(snap.slice(0, 2500))

  const rawBodyText = rawBodyChunks.filter(Boolean).join('\n\n').slice(0, 4200)

  return {
    rawBodyText,
    title: product.title ?? '',
    primaryDestination: product.primaryDestination ?? null,
    destination: product.destination ?? product.destinationRaw ?? null,
    duration: effectiveDurationForHeroSeoBackfill(product),
    summary: product.summary ?? null,
    themeTags: product.themeTags ?? null,
    primaryRegion: product.primaryRegion ?? null,
    themeLabelsRaw: product.themeLabelsRaw ?? null,
    includedText: product.includedText ?? null,
    excludedText: product.excludedText ?? null,
    benefitSummary: product.benefitSummary ?? null,
    optionalTourSummaryRaw: product.optionalTourSummaryRaw ?? null,
    scheduleDayTitles: scheduleDayTitlesForBackfill(product),
    scheduleImageKeywords: scheduleImageKeywordsForBackfill(product),
    productScheduleJson: product.schedule ?? null,
    originSourceForFallback: product.originSource ?? '',
  }
}

export function computeHeroSeoKeywordsJsonForBackfill(
  product: BackfillHeroSeoProductRow,
  analysis?: BackfillHeroSeoAnalysisRow | null
): string[] | null {
  return buildRegisterPublicImageHeroSeoKeywords(buildRegisterHeroSeoInputFromBackfillRow(product, analysis))
}

export function heroSeoLineFromKeywords(keywords: string[]): string {
  return keywords.join(' · ').slice(0, 240)
}
