/**
 * 상품 상세 히어로 캐러셀 — DAY 슬라이드 좌측 오버레이 전용.
 * 상품 전체 SEO 한 줄(`heroImageSeoKeywordOverlay`)과 경로를 섞지 않는다.
 */

const LINE_MAX = 24

/** 상품구성·운영·일정 서술 — 후보에 포함 시 무조건 탈락 (부분 일치) */
const OPERATIONAL_CONTAMINATION = [
  '현지옵션',
  '선택관광',
  '쇼핑',
  '포함사항',
  '불포함사항',
  '포함내역',
  '불포함내역',
  '출발',
  '도착',
  '이동',
  '미팅',
  '항공',
  '탑승',
  '기내',
  '숙박',
  '호텔',
  '조식',
  '중식',
  '석식',
  '자유시간',
  '가이드',
  '기사',
  '팁',
] as const

/** 파일·스톡·스토리지 흔적 — 대소문자 무시로 ASCII 구간 검사 */
const ASSET_CONTAMINATION_RES: readonly RegExp[] = [
  /\bpexels\b/i,
  /\bistock\b/i,
  /\bshutterstock\b/i,
  /\bunsplash\b/i,
  /\bphoto\b/i,
  /\bimg[_-]/i,
  /\bdsc[_-]/i,
  /\.(jpe?g|png|webp)(\b|[\s?#]|$)/i,
  /https?:\/\//i,
  /\bs3:\/\//i,
  /amazonaws|cloudfront|blob\.core|objectstorage|ncloud|ncp\b/i,
  /\bcdn\b/i,
  /\/v\d+\//i,
  /\b\d{5,}\b/,
  /_\d{3,}/,
  /[a-z0-9]{2,}_[a-z0-9]{2,}_/i,
]

/** 일정 본문형(기존) — 장소 단독이 아닌 서술 */
const ITINERARY_SENTENCE_RE =
  /인천|김포|공항|이동\s*및|이동합니다|현지\s*도착|픽업|송영|여행\s*시작|식사\s*후|호텔로/

const PLACE_TAIL =
  /(시내|구시가지|온천지구|온천|마을|거리|전망대|사원|성당|호수|국립공원|유적|해안|항구|섬|폭포|다리|광장|시장|타운|리조트|빌리지|구역)$/

function truncateOverlay(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function hangulCount(s: string): number {
  return (s.match(/[가-힣]/g) || []).length
}

function looksLikeItineraryNarrative(s: string): boolean {
  const t = s.replace(/\s+/g, ' ')
  if (t.length > 40) return true
  if ((t.match(/[,，]/g) || []).length >= 3) return true
  if (ITINERARY_SENTENCE_RE.test(t) && /출발|이동|도착|탑승|미팅/.test(t)) return true
  if (/합니다|입니다|하여|위해|따라서/.test(t)) return true
  if (/\s및\s| 그리고 |에서\s|동안\s|후\s/.test(t)) return true
  return false
}

function isContaminated(s: string): boolean {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return true
  const compact = t.replace(/\s/g, '')
  if (compact.includes('현지옵션')) return true
  if (/현지\s*옵션|옵션\s*\d/.test(t)) return true
  for (const w of OPERATIONAL_CONTAMINATION) {
    if (t.includes(w)) return true
  }
  for (const re of ASSET_CONTAMINATION_RES) {
    if (re.test(t)) return true
  }
  if (/옵션\s*\d+\s*개|쇼핑\s*\d+\s*개|관광\s*\d+\s*개|일정\s*\d+\s*개/.test(t)) return true
  if (/^\s*\d+\s*개\s*$/u.test(t)) return true
  if (/^[a-z0-9][a-z0-9._\-]*$/i.test(t) && /\d/.test(t)) return true
  const underscores = (t.match(/_/g) || []).length
  if (underscores >= 2) return true
  return false
}

/**
 * “짧은 장소형 명사구”만 통과. 문장·운영·파일명 냄새는 상위에서 이미 걸러짐.
 */
function isPlausibleShortPlaceLabel(s: string): boolean {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length < 2 || t.length > 28) return false
  const h = hangulCount(t)
  if (h >= 2) {
    /** 짧은 장소 복합명(예: 권역+시내)이 과도하게 탈락하지 않도록 한글만 소폭 완화 */
    if (t.length > 24 && !PLACE_TAIL.test(t)) return false
    return true
  }
  if (/^[A-Za-z][A-Za-z\s·]{1,26}$/.test(t) && !/\d/.test(t)) {
    const words = t.split(/\s+/).filter(Boolean)
    if (words.length <= 3 && t.length <= 24) return true
  }
  return false
}

/** 우선순위 파이프라인용: 통과 시 잘린 한 줄, 실패 시 null */
function acceptCleanPlaceCandidate(raw: string | null | undefined): string | null {
  if (raw == null) return null
  let t = String(raw).replace(/\s+/g, ' ').trim()
  if (t.length < 2) return null
  const beforeLongDash = t.split(/\s*[—–]\s*/)[0]?.trim() ?? t
  const beforeHyphen = beforeLongDash.split(/\s*-\s*/)[0]?.trim() ?? beforeLongDash
  t = beforeHyphen
  if (isContaminated(t)) return null
  if (!isPlausibleShortPlaceLabel(t)) return null
  if (looksLikeItineraryNarrative(t)) return null
  return truncateOverlay(t, LINE_MAX)
}

/** `1일차 후쿠오카`, `Day 2 : 유후인` 등에서 장소 꼬리만 */
function placeFromDayTitle(title: string | null | undefined): string | null {
  if (!title) return null
  let t = title.replace(/\s+/g, ' ').trim()
  if (!t) return null
  t = t.replace(/^\[\s*(\d+)\s*일차\s*\]\s*/i, '')
  t = t.replace(/^(\d+)\s*일차\s*[:\s、，,.\-–—]*\s*/i, '')
  t = t.replace(/^day\s*\d+\s*[:\s、，,.\-–—]+\s*/i, '')
  t = t.replace(/^제\s*\d+\s*일\s*[:\s、，,.\-–—]+\s*/i, '')
  t = t.split(/[|│]/)[0]?.trim() ?? t
  t = t.replace(/^\d+\s*일차\s*$/i, '').trim()
  return acceptCleanPlaceCandidate(t)
}

function destinationHead(primary: string | null | undefined, dest: string | null | undefined): string | null {
  const p = (primary ?? '').replace(/\s+/g, ' ').trim()
  if (p && !/[，,、]/.test(p) && p.length <= 14) {
    const x = acceptCleanPlaceCandidate(p)
    if (x) return x
  }
  const d = (dest ?? '').replace(/\s+/g, ' ').trim()
  const first = d.split(/[,，、/|·]/)[0]?.trim() ?? ''
  return acceptCleanPlaceCandidate(first)
}

export type CarouselDaySlideLabelInput = {
  day: number
  imageDisplayName?: string | null
  title?: string | null
  imageKeyword?: string | null
  /** ItineraryDay.city 등 일차 도시 */
  city?: string | null
  primaryDestination?: string | null
  destination?: string | null
}

/**
 * DAY 슬라이드 좌측 한 줄 — 장소명·도시·권역만(상품 대표 SEO 한 줄과 경로 분리).
 * 우선순위: imageDisplayName → title 장소 꼬리 → city → 목적지 앞머리 →
 * 장소형으로 통과한 imageKeyword → `N일차`.
 */
export function resolveCarouselDaySlideLeftLabel(input: CarouselDaySlideLabelInput): string | null {
  const fromImage = acceptCleanPlaceCandidate(input.imageDisplayName)
  if (fromImage) return fromImage

  const fromTitle = placeFromDayTitle(input.title)
  if (fromTitle) return fromTitle

  const fromCity = acceptCleanPlaceCandidate(input.city)
  if (fromCity) return fromCity

  const fromDest = destinationHead(input.primaryDestination, input.destination)
  if (fromDest) return fromDest

  const fromKw = acceptCleanPlaceCandidate(input.imageKeyword)
  if (fromKw) return fromKw

  if (input.day >= 1) return truncateOverlay(`${input.day}일차`, LINE_MAX)
  return null
}
