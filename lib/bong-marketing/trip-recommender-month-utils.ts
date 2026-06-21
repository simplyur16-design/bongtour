/** 클라이언트·서버 공용 — Gemini/prisma import 금지 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export function monthLabelFromNumber(month: number): string {
  return `${month}월`
}

/** 현재 월부터 12개월 롤링 순서 (예: 6월 시작 → 6,7,...,12,1,...,5) */
export function rollingMonthsFrom(startMonth: number, count = 12): number[] {
  const start = Math.min(12, Math.max(1, Math.floor(startMonth)))
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    out.push(((start - 1 + i) % 12) + 1)
  }
  return out
}

/** 월 → 계절 (카드뉴스·블로그 레거시 API용, 추천 UI 분류에는 사용 안 함) */
export function monthToSeason(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

export function parseMonthNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.floor(value)
    if (n >= 1 && n <= 12) return n
  }
  if (typeof value === 'string' && value.trim()) {
    const single = value.trim().match(/^(\d{1,2})\s*월$/)
    if (single) {
      const n = parseInt(single[1], 10)
      if (n >= 1 && n <= 12) return n
    }
    const range = value.match(/(\d{1,2})\s*[-~]\s*(\d{1,2})\s*월/)
    if (range) {
      const n = parseInt(range[1], 10)
      if (n >= 1 && n <= 12) return n
    }
    const anyMonth = value.match(/(\d{1,2})\s*월/)
    if (anyMonth) {
      const n = parseInt(anyMonth[1], 10)
      if (n >= 1 && n <= 12) return n
    }
  }
  return null
}
