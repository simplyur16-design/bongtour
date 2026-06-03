/**
 * Fit 예시 일정 → Product.schedule[].imageKeyword (에어텔 등록 후 동기화 전용).
 */
import { persistScheduleImageKeyword } from '@/lib/schedule-image-keyword-persist'
import { resolveTravelSubjectEnForMedia } from '@/lib/pexels-keyword'

export type FitItineraryActivityForKeyword = {
  order: number
  category: string
  title: string
  description: string
  location: string
}

export type FitItineraryDayForKeyword = {
  dayNumber: number
  title: string
  summary: string
  dayCityKey?: string
  activities: FitItineraryActivityForKeyword[]
}

const KEYWORD_CATEGORY_ORDER = ['attraction', 'shopping', 'meal'] as const

const CJK_IN_PAREN_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/

function extractEnglishPlacePhrase(text: string): string | null {
  const t = String(text ?? '').trim()
  if (!t) return null

  const parenMatches = [...t.matchAll(/\(\s*([^)]+)\s*\)/g)]
  for (let i = parenMatches.length - 1; i >= 0; i--) {
    const inner = parenMatches[i]![1]!.trim()
    if (inner.length < 3 || !/[A-Za-z]{3,}/.test(inner)) continue
    if (CJK_IN_PAREN_RE.test(inner)) continue
    return inner
  }

  if (/^[A-Za-z0-9][A-Za-z0-9\s,.'\-–—]{2,}$/.test(t) && /[A-Za-z]{3,}/.test(t)) {
    return t
  }
  return null
}

function tryPersistFitImageKeyword(raw: string): string | null {
  try {
    const v = persistScheduleImageKeyword(raw)
    return v || null
  } catch {
    return null
  }
}

function keywordFromActivity(act: FitItineraryActivityForKeyword): string | null {
  for (const field of [act.location, act.title, act.description]) {
    const phrase = extractEnglishPlacePhrase(field)
    if (!phrase) continue
    const kw = tryPersistFitImageKeyword(phrase)
    if (kw) return kw
  }
  return null
}

export type FitDayImageKeywordFallbackContext = {
  cityNameKo: string
  cityKey: string
  productTitle: string
  primaryDestination?: string | null
  destination?: string | null
}

export function buildFitDayImageKeywordFallback(ctx: FitDayImageKeywordFallbackContext): string {
  const subject = resolveTravelSubjectEnForMedia({
    destination: ctx.primaryDestination ?? ctx.destination ?? ctx.cityNameKo,
    primaryRegion: ctx.cityKey,
    title: ctx.productTitle,
    themeTags: null,
  })
  if (subject && subject !== 'travel') {
    const kw = tryPersistFitImageKeyword(subject)
    if (kw) return kw
  }
  const city = ctx.cityNameKo.trim()
  if (city) {
    const kw = tryPersistFitImageKeyword(city)
    if (kw) return kw
  }
  return 'travel'
}

/** 일차 대표 Pexels 키워드 — attraction → shopping → meal, 없으면 상품 도시 폴백 */
export function pickFitDayImageKeyword(
  day: FitItineraryDayForKeyword,
  fallbackCtx: FitDayImageKeywordFallbackContext,
): string {
  const activities = [...(day.activities ?? [])].sort((a, b) => a.order - b.order)
  for (const cat of KEYWORD_CATEGORY_ORDER) {
    for (const act of activities) {
      if (act.category !== cat) continue
      const kw = keywordFromActivity(act)
      if (kw) return kw
    }
  }
  return buildFitDayImageKeywordFallback(fallbackCtx)
}
