export type ScheduleImageLike = {
  day?: number
  imageUrl?: string | null
  imageManualSelected?: boolean
  imageSelectionMode?: string | null
  /** 대표 커버 후보 스코어링(없으면 무시) */
  title?: string | null
  description?: string | null
  imageKeyword?: string | null
  imageDisplayName?: string | null
}

/** 공항·이동·미팅 등 대표 커버로 부적절한 일차 텍스트(이미지 URL만 있을 때는 false) */
const POOR_COVER_DAY_TEXT_RE =
  /인천|김포|공항|\bICN\b|\bGMP\b|출발|도착|이동|기내|미팅|탑승|송영|공항철도|체크인|환승|픽업|셔틀|탑승장|게이트|수속/i

function haystackForCoverDay(day: ScheduleImageLike): string {
  return [day.title, day.description, day.imageKeyword, day.imageDisplayName]
    .map((x) => (typeof x === 'string' ? x : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 일차 메타만 보고 대표 커버로 부적절한지(이미지 URL 유무와 무관) */
export function scheduleRowIsPoorRepresentativeCover(day: ScheduleImageLike): boolean {
  const t = haystackForCoverDay(day)
  if (!t) return false
  return POOR_COVER_DAY_TEXT_RE.test(t)
}

export function getFinalScheduleDayImageUrl(day: ScheduleImageLike | null | undefined): string | null {
  if (!day?.imageUrl) return null
  const imageUrl = String(day.imageUrl).trim()
  if (!imageUrl) return null
  if (day.imageManualSelected === true) return imageUrl
  if (day.imageSelectionMode === 'library-reuse') return imageUrl
  return imageUrl
}

export function getFinalCoverImageUrl(options: {
  bgImageUrl?: string | null
  scheduleDays?: ScheduleImageLike[] | null
}): string | null {
  if (options.bgImageUrl && String(options.bgImageUrl).trim()) return String(options.bgImageUrl).trim()
  if (!Array.isArray(options.scheduleDays) || options.scheduleDays.length === 0) return null

  const ordered = [...options.scheduleDays].sort((a, b) => (Number(a.day) || 0) - (Number(b.day) || 0))
  const withUrl = ordered.filter((d) => !!getFinalScheduleDayImageUrl(d))
  if (withUrl.length === 0) return null

  const good = withUrl.filter((d) => !scheduleRowIsPoorRepresentativeCover(d))
  const pick =
    good[0] ??
    withUrl.find((d) => (Number(d.day) || 0) >= 2) ??
    withUrl[0] ??
    null
  return pick ? getFinalScheduleDayImageUrl(pick) : null
}
