/**
 * 시즌 큐레이션·해외 허브 히어로 부제(subline/subtitle) — 한 문장 SSOT.
 */
import { sublineWithTargetMonth } from '@/lib/season-hero-target-months'

/** "8월 도쿄 일본", "도쿄 · 일본" 등 나열형·라벨형 부제 거부 */
const LABEL_LIST_SUBTITLE =
  /^(\d{1,2}\s*월\s*)?[\p{L}\d]+(\s[\p{L}\d]+){0,3}$/u

const HAS_SENTENCE_SHAPE =
  /[,，]|(을|를|이|가|은|는|의|에|과|와|도|로|으로|다|요|니다|습니다|세요|해보|만나|떠나|걷|느껴|스며|품은|이어|펼쳐|초대|기록|향기|바람|빛|계절|여름|가을|겨울|봄)/

export function isValidSeasonCurationSubtitle(raw: string | null | undefined): boolean {
  const t = (raw ?? '').trim().replace(/\s+/g, ' ')
  if (t.length < 12 || t.length > 90) return false
  if (t.includes(' · ') || t.includes('·')) return false
  if (LABEL_LIST_SUBTITLE.test(t) && !HAS_SENTENCE_SHAPE.test(t)) return false
  if (/^\d{1,2}\s*월\s*[\p{L}\d]+(\s[\p{L}\d]+){1,2}$/u.test(t)) return false
  return HAS_SENTENCE_SHAPE.test(t)
}

export function firstSentenceFromText(text: string, maxLen = 80): string {
  const t = text.trim().replace(/\s+/g, ' ')
  if (!t) return ''
  const cut = t.split(/(?<=[.!?…])\s+/)[0]?.trim() ?? t
  if (cut.length <= maxLen) return cut
  return `${cut.slice(0, maxLen - 1).trimEnd()}…`
}

/** 나열형 부제 대신 쓰는 한 문장 폴백 */
export function buildSeasonCurationSublineFallback(
  targetMonth1To12: number,
  cityLabel: string,
  countryLabel?: string | null,
): string {
  const city = cityLabel.trim() || '여행지'
  const country = (countryLabel ?? '').trim()
  if (country && country !== city) {
    return `${targetMonth1To12}월의 ${city}, ${country}을(를) 가장 선명하게 만나는 계절의 문턱입니다.`
  }
  return `${targetMonth1To12}월의 ${city}, 여행하기 좋은 계절의 숨결이 스며듭니다.`
}

/**
 * 시즌 히어로·카드 부제 — Gemini reasoning 우선, 라벨형(koreanSubtitle) 폴백 금지.
 */
export function resolveSeasonCurationSubline(opts: {
  targetMonth1To12: number
  geminiLine?: string | null
  cityLabel: string
  countryLabel?: string | null
  bodyFallback?: string | null
}): string {
  const gemini = (opts.geminiLine ?? '').trim()
  if (isValidSeasonCurationSubtitle(gemini)) {
    return sublineWithTargetMonth(opts.targetMonth1To12, gemini)
  }

  const fromBody = firstSentenceFromText(opts.bodyFallback ?? '', 72)
  if (isValidSeasonCurationSubtitle(fromBody)) {
    return sublineWithTargetMonth(opts.targetMonth1To12, fromBody)
  }

  return buildSeasonCurationSublineFallback(
    opts.targetMonth1To12,
    opts.cityLabel,
    opts.countryLabel,
  )
}
