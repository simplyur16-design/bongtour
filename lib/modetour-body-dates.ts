/**
 * 모두투어(MODETOUR) 전용 — 본문(raw)에서 문맥 기반 출발일·도착(귀국)일 후보 추출.
 * 다른 공급사에서는 사용하지 않는다.
 */

import { extractIsoDateMatchesWithIndex } from '@/lib/hero-date-utils'

const R = 140
const MIN_CTX_SCORE = 3

function sliceCtx(fullText: string, index: number, length: number): string {
  const start = Math.max(0, index - R)
  const end = Math.min(fullText.length, index + length + R)
  return fullText.slice(start, end)
}

/** 출발·출국·가는편 등 문맥 점수 */
export function scoreModetourDepartureContext(fullText: string, matchIndex: number, matchLength: number): number {
  const ctx = sliceCtx(fullText, matchIndex, matchLength)
  let s = 0
  if (/출발일/.test(ctx)) s += 9
  if (/출국일/.test(ctx)) s += 8
  if (/가는\s*편/.test(ctx)) s += 7
  if (/(?:인천|김포|김해)\s*(?:국제)?(?:공항)?[^\n]{0,24}출발/.test(ctx)) s += 7
  if (/출발[^\n]{0,16}(?:인천|김포|김해|한국)/.test(ctx)) s += 6
  if (/(?:한국|국내)[^\n]{0,20}출발/.test(ctx)) s += 6
  if (/출국/.test(ctx)) s += 5
  if (/출발(?!\s*일)/.test(ctx)) s += 3
  if (/(?:귀국일|도착일|복귀|오는\s*편)/.test(ctx) && !/(?:출발|출국|가는)/.test(ctx)) s -= 8
  return s
}

/** 귀국·도착·오는편 등 문맥 점수 */
export function scoreModetourArrivalContext(fullText: string, matchIndex: number, matchLength: number): number {
  const ctx = sliceCtx(fullText, matchIndex, matchLength)
  let s = 0
  if (/도착일/.test(ctx)) s += 9
  if (/귀국일/.test(ctx)) s += 9
  if (/오는\s*편/.test(ctx)) s += 7
  if (/(?:인천|김포|김해)\s*(?:국제)?(?:공항)?[^\n]{0,24}도착/.test(ctx)) s += 7
  if (/(?:한국\s*도착|국내\s*도착)/.test(ctx)) s += 6
  if (/귀국/.test(ctx)) s += 5
  if (/복귀/.test(ctx)) s += 5
  if (/도착/.test(ctx)) s += 3
  if (/(?:가는\s*편|출국\s*편|출발일)(?![\s\S]{0,80}(?:귀국|도착|오는))/.test(ctx)) s -= 6
  return s
}

export type ModetourBodyDateExtract = {
  departureIso: string | null
  arrivalIso: string | null
  departureCtxScore: number
  arrivalCtxScore: number
}

/**
 * 본문에서 문맥 점수가 충분한 출발·도착 후보를 각각 고른다.
 * 도착은 출발 후보와 다른 날짜(출발일 이후)를 우선한다.
 */
export function extractModetourBodyDepartureArrival(rawText: string | null | undefined): ModetourBodyDateExtract {
  if (!rawText?.trim()) {
    return { departureIso: null, arrivalIso: null, departureCtxScore: 0, arrivalCtxScore: 0 }
  }
  const full = String(rawText).replace(/\r/g, '\n')
  const matches = extractIsoDateMatchesWithIndex(full)
  if (matches.length === 0) {
    return { departureIso: null, arrivalIso: null, departureCtxScore: 0, arrivalCtxScore: 0 }
  }

  let bestDep: (typeof matches)[0] | null = null
  let bestDepScore = -1
  for (const m of matches) {
    const sc = scoreModetourDepartureContext(full, m.index, m.length)
    if (sc < MIN_CTX_SCORE) continue
    if (!bestDep || sc > bestDepScore || (sc === bestDepScore && m.iso < bestDep.iso)) {
      bestDep = m
      bestDepScore = sc
    }
  }

  const depIso = bestDep?.iso ?? null

  let bestArr: (typeof matches)[0] | null = null
  let bestArrScore = -1
  for (const m of matches) {
    const sc = scoreModetourArrivalContext(full, m.index, m.length)
    if (sc < MIN_CTX_SCORE) continue
    if (depIso) {
      if (m.iso < depIso) continue
      if (m.iso === depIso) continue
    }
    if (!bestArr || sc > bestArrScore || (sc === bestArrScore && m.iso > bestArr.iso)) {
      bestArr = m
      bestArrScore = sc
    }
  }

  return {
    departureIso: depIso,
    arrivalIso: bestArr?.iso ?? null,
    departureCtxScore: bestDep ? bestDepScore : 0,
    arrivalCtxScore: bestArr ? bestArrScore : 0,
  }
}

/** 상품 상세에 남은 본문 조각을 모아 모두투어 날짜 문맥 추출용 blob으로 쓴다. */
export type ModetourHaystackProductLike = {
  title?: string | null
  includedText?: string | null
  excludedText?: string | null
  reservationNoticeRaw?: string | null
  hotelSummaryRaw?: string | null
  hotelSummaryText?: string | null
  benefitSummary?: string | null
  promotionLabelsRaw?: string | null
  criticalExclusions?: string | null
  priceTableRawText?: string | null
  schedule?: Array<{ title?: string | null; description?: string | null }> | null
  flightStructured?: {
    departureSegmentText?: string | null
    returnSegmentText?: string | null
    routeRaw?: string | null
    departureDateTimeRaw?: string | null
    arrivalDateTimeRaw?: string | null
  } | null
}

export function buildModetourHeroHaystackFromProduct(p: ModetourHaystackProductLike): string {
  const parts: string[] = []
  const push = (s?: string | null) => {
    const t = s?.trim()
    if (t) parts.push(t)
  }
  push(p.title)
  push(p.includedText)
  push(p.excludedText)
  push(p.reservationNoticeRaw)
  push(p.hotelSummaryRaw)
  push(p.hotelSummaryText)
  push(p.benefitSummary)
  push(p.promotionLabelsRaw)
  push(p.criticalExclusions)
  push(p.priceTableRawText)
  if (p.schedule?.length) {
    for (const d of p.schedule) {
      push(d.title)
      push(d.description)
    }
  }
  const fs = p.flightStructured
  if (fs) {
    push(fs.departureSegmentText)
    push(fs.returnSegmentText)
    push(fs.routeRaw)
    push(fs.departureDateTimeRaw)
    push(fs.arrivalDateTimeRaw)
  }
  return parts.join('\n\n')
}
