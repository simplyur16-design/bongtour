/**
 * Fit 예시 일정 day.summary / master.summary — 2문장 SSOT 보정 (Gemini 1문장 폴백).
 */

const FIT_DAY_SECOND_SENTENCE_DEFAULT =
  '이동·입장 시간은 현지 상황에 맞게 여유 있게 잡으시면 하루 동선이 편합니다.'

const FIT_MASTER_SECOND_SENTENCE_DEFAULT =
  '아래는 참고용 예시 일정이며, 방문 순서와 시간은 자유롭게 조정하셔도 됩니다.'

export type FitSummarySentenceOpts = {
  title?: string | null
  /** activities[].location 한글 등 — 2문장째 맞춤용 */
  landmarkHint?: string | null
}

function normalizeSummaryWhitespace(text: string): string {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim()
}

/** 마침표·물음·느낌표·줄바꿈 기준 문장 분리 */
export function splitFitSummarySentences(text: string): string[] {
  const t = normalizeSummaryWhitespace(text)
  if (!t) return []
  const parts = t
    .split(/(?<=[.!?。])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4)
  if (parts.length >= 2) return parts
  if (t.includes('\n')) {
    const lines = t
      .split(/\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 8)
    if (lines.length >= 2) return lines
  }
  return parts.length ? parts : [t]
}

export function countFitSummarySentences(text: string): number {
  return splitFitSummarySentences(text).length
}

function ensureSentenceTerminal(s: string): string {
  const t = s.trim()
  if (!t) return ''
  if (/[.!?。]$/.test(t)) return t
  return `${t}.`
}

function buildFitDaySecondSentence(opts?: FitSummarySentenceOpts): string {
  const hint = String(opts?.landmarkHint ?? opts?.title ?? '').trim()
  if (hint.length >= 2 && /[\uAC00-\uD7AF]/.test(hint)) {
    return `${hint} 일대는 이동 전에 대기 시간을 넉넉히 잡으시면 편해요.`
  }
  return FIT_DAY_SECOND_SENTENCE_DEFAULT
}

/** day.summary — 정확히 2문장(마침표 구분). 1문장이면 2문장째를 규칙으로 붙임 */
export function ensureFitDaySummaryTwoSentences(
  summary: string,
  opts?: FitSummarySentenceOpts,
): string {
  const sentences = splitFitSummarySentences(summary)
  if (sentences.length >= 2) {
    const a = ensureSentenceTerminal(sentences[0]!)
    const b = ensureSentenceTerminal(sentences[1]!)
    return `${a} ${b}`.trim()
  }

  const firstRaw = sentences[0] ?? normalizeSummaryWhitespace(summary)
  if (!firstRaw) {
    const hint = String(opts?.landmarkHint ?? opts?.title ?? '오늘 일정').trim() || '오늘 일정'
    return `${hint}을(를) 여유 있게 둘러보시기 좋은 날이에요. ${FIT_DAY_SECOND_SENTENCE_DEFAULT}`
  }

  const first = ensureSentenceTerminal(firstRaw)
  const second = ensureSentenceTerminal(buildFitDaySecondSentence(opts))
  return `${first} ${second}`.trim()
}

/** master.summary — 상품 최상위 2문장 */
export function ensureFitMasterSummaryTwoSentences(summary: string): string {
  const sentences = splitFitSummarySentences(summary)
  if (sentences.length >= 2) {
    const a = ensureSentenceTerminal(sentences[0]!)
    const b = ensureSentenceTerminal(sentences[1]!)
    return `${a} ${b}`.trim()
  }

  const firstRaw = sentences[0] ?? normalizeSummaryWhitespace(summary)
  if (!firstRaw) {
    return `현지에서 즐기기 좋은 동선으로 구성했습니다. ${FIT_MASTER_SECOND_SENTENCE_DEFAULT}`
  }

  const first = ensureSentenceTerminal(firstRaw)
  const second = ensureSentenceTerminal(FIT_MASTER_SECOND_SENTENCE_DEFAULT)
  return `${first} ${second}`.trim()
}

export function extractFitLandmarkHintKoFromActivities(
  activities: ReadonlyArray<{ location?: string | null; title?: string | null }>,
): string | null {
  for (const a of activities) {
    const loc = String(a.location ?? '').trim()
    if (loc) {
      const ko = loc.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
      if (ko.length >= 2 && /[\uAC00-\uD7AF]/.test(ko)) return ko
    }
    const title = String(a.title ?? '').trim()
    if (title.length >= 2 && /[\uAC00-\uD7AF]/.test(title)) return title
  }
  return null
}
