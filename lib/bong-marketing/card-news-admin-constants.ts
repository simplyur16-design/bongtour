export const CARD_NEWS_SEASONS = [
  { value: '', label: '미지정' },
  { value: 'spring', label: '봄' },
  { value: 'summer', label: '여름' },
  { value: 'autumn', label: '가을' },
  { value: 'winter', label: '겨울' },
  { value: 'all_year', label: '연중' },
] as const

export const CARD_NEWS_SERIES_STATUS_LABEL: Record<string, string> = {
  draft: '초안',
  generating: '생성 중',
  ready: '준비됨',
  published: '게시됨',
  archived: '보관',
}

export const CARD_NEWS_EPISODE_STATUS_LABEL: Record<string, string> = {
  draft: '초안',
  generating: '생성 중',
  ready: '준비됨',
  edited: '편집됨',
  published: '게시됨',
}

export function seasonLabel(season: string | null | undefined): string {
  if (!season) return '미지정'
  return CARD_NEWS_SEASONS.find((s) => s.value === season)?.label ?? season
}

/** ISO week key YYYY-Www */
export function isoWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}
