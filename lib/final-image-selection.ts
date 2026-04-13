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

/** URL 경로에 자주 나오는 저해상·썸네일 힌트(메인 허브 4카드 전용 후보만 비교) */
const HUB_COVER_THUMB_HINT_RE =
  /thumb|thumbnail|_s\.|_xs\b|\/small\/|\/thumb\/|w=\d{2,3}\b|width=\d{2,3}\b|size=\d{2,3}\b|\bresize\b|\bcompress\b|\/\d{2,3}x\d{2,3}\//i

function scoreHubCoverUrlCandidate(
  url: string,
  meta?: { manualSelected?: boolean; poorCoverDay?: boolean }
): number {
  const u = url.trim()
  let s = Math.min(u.length, 900)
  if (HUB_COVER_THUMB_HINT_RE.test(u)) s -= 220
  if (meta?.poorCoverDay) s -= 90
  if (meta?.manualSelected) s += 120
  return s
}

/**
 * 메인 허브 4카드(해외/국내) 전용 — `getFinalCoverImageUrl`과 동일 필드만 사용.
 * bg·일정 이미지 URL 후보를 모아 썸네일 힌트가 약한 쪽을 우선(동일 필드, DB 변경 없음).
 */
export function getHomeHubCoverImageUrl(options: {
  bgImageUrl?: string | null
  scheduleDays?: ScheduleImageLike[] | null
}): string | null {
  const scored: { url: string; score: number }[] = []
  const bg = options.bgImageUrl?.trim()
  if (bg) scored.push({ url: bg, score: scoreHubCoverUrlCandidate(bg) })

  if (Array.isArray(options.scheduleDays) && options.scheduleDays.length > 0) {
    const ordered = [...options.scheduleDays].sort((a, b) => (Number(a.day) || 0) - (Number(b.day) || 0))
    for (const d of ordered) {
      const u = getFinalScheduleDayImageUrl(d)
      if (!u) continue
      scored.push({
        url: u,
        score: scoreHubCoverUrlCandidate(u, {
          manualSelected: d.imageManualSelected === true,
          poorCoverDay: scheduleRowIsPoorRepresentativeCover(d),
        }),
      })
    }
  }

  if (scored.length === 0) return null
  const seen = new Set<string>()
  const uniq = scored.filter((x) => {
    if (seen.has(x.url)) return false
    seen.add(x.url)
    return true
  })
  uniq.sort((a, b) => b.score - a.score || b.url.length - a.url.length)
  return uniq[0]!.url
}
