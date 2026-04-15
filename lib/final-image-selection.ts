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

/** 상품 대표 커버·히어로 SSOT: 본 관광·랜드마크 가산, 공항·첫·막일 감산 */
const COVER_LANDMARK_HINT_RE =
  /피오르드|fjord|geiranger|nyhavn|sigiriya|stupa|ruwanwelisaya|temple|palace|castle|museum|fortress|monument|국립|세계유산|랜드마크|harbor|harbour|heritage|unesco|waterfall|canyon|glacier|fjäll|square|plaza|old\s*town|wieliczka/i

const COVER_STRONG_AIRPORT_RE =
  /인천|김포|\bICN\b|\bGMP\b|\bCMB\b|bandaranaike|international\s+airport|airport\s+terminal|출국장|입국장|탑승동|boarding\s*gate|departure\s*hall/i

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

/**
 * 상품 대표 이미지(커버) 후보 일차 스코어 — 높을수록 우선.
 * 1·막일·공항 동선은 낮추고, 중간 일정·랜드마크 힌트는 올린다.
 */
export function scoreScheduleDayForProductCover(day: ScheduleImageLike, maxDay: number): number {
  const dayNum = Number(day.day) || 0
  const hay = haystackForCoverDay(day)
  let s = 0
  if (hay && !scheduleRowIsPoorRepresentativeCover(day)) s += 72
  if (COVER_LANDMARK_HINT_RE.test(hay)) s += 58
  if (COVER_STRONG_AIRPORT_RE.test(hay)) s -= 125
  if (maxDay > 1) {
    if (dayNum === 1) s -= 48
    if (dayNum === maxDay) s -= 32
    if (dayNum >= 2 && dayNum < maxDay) s += 52
  }
  return s
}

type ScheduleImageWithUrl = ScheduleImageLike & { imageUrl?: string | null }

/** 일정 슬롯 중 상품 대표 커버로 쓸 한 장 — 첫 일차·공항 위주가 아니라 전체 여행의 상징 일차 */
export function pickRepresentativeCoverScheduleDay<T extends ScheduleImageWithUrl>(rows: T[]): T | null {
  const withUrl = rows.filter((r) => {
    const u = r.imageUrl != null ? String(r.imageUrl).trim() : ''
    return !!u && !!getFinalScheduleDayImageUrl(r)
  })
  if (withUrl.length === 0) return null
  const maxDay = Math.max(...withUrl.map((r) => Number(r.day) || 0), 0)
  const scored = withUrl.map((r) => ({ r, score: scoreScheduleDayForProductCover(r, maxDay) }))
  scored.sort((a, b) => b.score - a.score || (Number(a.r.day) || 0) - (Number(b.r.day) || 0))
  const top = scored[0]!
  if (top.score >= -80) return top.r
  const rescue = [...scored].sort(
    (a, b) => (Number(b.r.day) || 0) - (Number(a.r.day) || 0) || b.score - a.score
  )
  return rescue.find((x) => x.score > -200)?.r ?? top.r
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

  const enriched = withUrl.map((d) => ({
    ...d,
    imageUrl: getFinalScheduleDayImageUrl(d),
  }))
  const pick = pickRepresentativeCoverScheduleDay(enriched)
  return pick ? getFinalScheduleDayImageUrl(pick) : null
}

/** URL에 자주 나오는 저해상·썸네일 힌트(메인 허브 4카드 전용 후보만 비교) */
const HUB_COVER_THUMB_HINT_RE =
  /thumb|thumbnail|_s\.|_xs\b|\/small\/|\/thumb\/|\bresize\b|\/\d{2,3}x\d{2,3}\//i

/** `w=80` 등 짧은 변만 썸네일로 간주(`w=940`은 제외) */
function hubCoverUrlHasTinyQueryDims(url: string): boolean {
  const re = /[?&](?:w|width|h|height)=(\d+)/gi
  let m: RegExpExecArray | null
  const nums: number[] = []
  while ((m = re.exec(url)) !== null) nums.push(Number.parseInt(m[1], 10))
  if (nums.length === 0) return false
  const maxSide = Math.max(...nums)
  return maxSide > 0 && maxSide < 480
}

/** CDN 쿼리의 `auto=compress` 등(단어 경계 compress) */
function hubCoverUrlLooksCompressedOrTinyRgb(url: string): boolean {
  return /\bcompress\b/i.test(url) || /tinysrgb/i.test(url)
}

function scoreHubCoverUrlCandidate(
  url: string,
  meta?: { manualSelected?: boolean; poorCoverDay?: boolean }
): number {
  const u = url.trim()
  let s = Math.min(u.length, 900)
  if (HUB_COVER_THUMB_HINT_RE.test(u)) s -= 220
  if (hubCoverUrlHasTinyQueryDims(u)) s -= 200
  if (hubCoverUrlLooksCompressedOrTinyRgb(u)) s -= 80
  if (meta?.poorCoverDay) s -= 90
  if (meta?.manualSelected) s += 120
  return s
}

/**
 * 메인 허브 풀 커버 전용 — DB에 저장된 Pexels 프리뷰(`w`/`h` 작음)를 그대로 쓰지 않고
 * 동일 호스트·쿼리 형식으로 더 큰 변을 요청(스키마·공급사 파이프라인 변경 없음).
 */
function upgradeHomeHubPoolStockImageUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  try {
    const u = new URL(trimmed)
    if (!/\.pexels\.com$/i.test(u.hostname) && !u.hostname.endsWith('pexels.com')) return trimmed
    const wStr = u.searchParams.get('w')
    const hStr = u.searchParams.get('h')
    if (wStr == null && hStr == null) return trimmed
    const wn = wStr ? Number.parseInt(wStr, 10) : 0
    const hn = hStr ? Number.parseInt(hStr, 10) : 0
    if (!Number.isFinite(wn) || !Number.isFinite(hn)) return trimmed
    if (wn >= 1600 && hn >= 1000) return trimmed
    u.searchParams.set('w', '1920')
    u.searchParams.set('h', '1280')
    return u.toString()
  } catch {
    return trimmed
  }
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
    const maxDay = Math.max(...ordered.map((d) => Number(d.day) || 0), 0)
    for (const d of ordered) {
      const u = getFinalScheduleDayImageUrl(d)
      if (!u) continue
      const coverBias = scoreScheduleDayForProductCover(d, maxDay) * 0.22
      scored.push({
        url: u,
        score:
          scoreHubCoverUrlCandidate(u, {
            manualSelected: d.imageManualSelected === true,
            poorCoverDay: scheduleRowIsPoorRepresentativeCover(d),
          }) + coverBias,
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
  return upgradeHomeHubPoolStockImageUrl(uniq[0]!.url)
}
