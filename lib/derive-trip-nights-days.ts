/**
 * 표시·비교 시점 — Product.tripNights / tripDays 도출 SSOT.
 * duration · title · 일정 일수에서만 추론 (DB 백필 없음).
 * 「5일」만 있을 때 nights를 days-1로 지어내지 않는다 (3박5일 혼입 방지).
 */

export type DeriveTripNightsDaysInput = {
  duration?: string | null
  title?: string | null
  /** schedule / itinerary day count — days가 비었을 때만 채움 */
  scheduleDayCount?: number | null
  /** DB에 이미 있으면 우선 (표시 SSOT; 백필 아님) */
  tripNights?: number | null
  tripDays?: number | null
}

export type DeriveTripNightsDaysResult = {
  tripNights: number | null
  tripDays: number | null
  /** 공개·비교 한 줄 라벨 */
  label: string | null
}

/**
 * 제목 머리 구간 — 첫 「#」 이전 (비었으면 첫 비어있지 않은 # 조각).
 * REGRESSION-FREEZE[trip-duration-hashtag-leak]: 해시태그 속 「후르가다 2박3일」 같은 부분 일정이
 * 상품 전체 박일로 새지 않게 머리 구간을 먼저 본다.
 */
export function titleHeadBeforeHashtag(title: string | null | undefined): string {
  const segs = String(title || '').split('#').map((s) => s.trim())
  return segs.find((s) => s.length > 0) ?? ''
}

/** 「1일자유」「2일차」「3일째」「1일관광」 등 부분 일정 — 상품 길이 아님 */
const PARTIAL_DAY_SUFFIX_RE = /^\s*(?:자유|차|째|관광|투어|숙박|패스|권|체험|일정)/

function durationHintFromText(hay: string): string | null {
  const nm = hay.match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (nm) return `${nm[1]}박 ${nm[2]}일`
  const re = /(?<!\d)(\d+)\s*일(?!\d)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(hay)) != null) {
    if (PARTIAL_DAY_SUFFIX_RE.test(hay.slice(m.index + m[0].length))) continue
    if (Number(m[1]) >= 1) return `${m[1]}일`
  }
  return null
}

/** 제목 머리 구간만 (해시태그 부분 일정 미사용) — 등록 저장 경로 */
export function durationHintFromTitleHeadOnly(title: string | null | undefined): string | null {
  return durationHintFromText(titleHeadBeforeHashtag(title))
}

/** title에서 N박M일 / M일 힌트 — 머리 구간 우선, 없으면 전체 (bongtour durationHintFromTitle 와 동일 규칙) */
export function durationHintFromTitleLocal(title: string): string | null {
  const hay = String(title || '')
  return durationHintFromText(titleHeadBeforeHashtag(hay)) ?? durationHintFromText(hay)
}

/** 제목 「#」 뒤 구간에만 같은 N박M일이 있는지 (머리 구간엔 없음) */
function nightsDaysAppearsOnlyInHashtags(title: string, nights: number, days: number): boolean {
  const hay = String(title || '')
  const head = titleHeadBeforeHashtag(hay)
  const re = new RegExp(`(?<!\\d)${nights}\\s*박\\s*${days}\\s*일`)
  if (re.test(head)) return false
  const headIdx = head ? hay.indexOf(head) : -1
  const rest = headIdx >= 0 ? hay.slice(0, headIdx) + hay.slice(headIdx + head.length) : hay
  return re.test(rest)
}

function parseNightsDaysFromLabel(label: string | null | undefined): {
  nights: number | null
  days: number | null
} {
  const t = String(label || '').trim()
  if (!t) return { nights: null, days: null }
  const nm = t.match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (nm) {
    return { nights: Number(nm[1]), days: Number(nm[2]) }
  }
  const nightsOnly = t.match(/(\d+)\s*박/)
  if (nightsOnly && !/(\d+)\s*일/.test(t)) {
    const n = Number(nightsOnly[1])
    // nights-only: days 미확정 (nights+1 가정 금지)
    return { nights: n, days: null }
  }
  const daysOnly = t.match(/(?<!\d)(\d+)\s*일(?!\d)/)
  if (daysOnly) {
    const d = Number(daysOnly[1])
    // days-only: nights 미확정 (4박5일 가정 금지)
    return { nights: null, days: d }
  }
  return { nights: null, days: null }
}

/**
 * REGRESSION-FREEZE[trip-nights-null-not-zero]
 * null / undefined / '' / NaN / 비정수 → null (미확정). Number(null)===0 함정 금지 — 「0박 N일」 발명 방지.
 * 숫자 문자열("4")만 허용, 추측·보정 없음.
 */
export function toKnownTripCount(v: unknown, min: number): number | null {
  let n: number
  if (typeof v === 'number') n = v
  else if (typeof v === 'string' && /^\s*\d+\s*$/.test(v)) n = Number(v)
  else return null
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min) return null
  return n
}

export function formatTripNightsDaysLabel(
  tripNights: number | null,
  tripDays: number | null,
): string | null {
  if (tripNights != null && tripDays != null) return `${tripNights}박 ${tripDays}일`
  if (tripDays != null) return `${tripDays}일`
  if (tripNights != null) return `${tripNights}박`
  return null
}

/**
 * duration → title hint → (optional) DB scalars → schedule length 순.
 * days-only 라벨에서는 nights를 발명하지 않는다.
 */
export function deriveTripNightsDays(input: DeriveTripNightsDaysInput): DeriveTripNightsDaysResult {
  const durationRaw = String(input.duration || '').trim() || null
  const fromDuration = parseNightsDaysFromLabel(durationRaw)
  const titleStr = String(input.title || '')
  const titleHint = durationHintFromTitleLocal(titleStr)
  const fromTitle = parseNightsDaysFromLabel(titleHint)

  let tripDays = fromDuration.days ?? fromTitle.days
  let tripNights = fromDuration.nights ?? fromTitle.nights

  // REGRESSION-FREEZE[trip-duration-hashtag-leak]: 저장 duration이 제목 해시태그 속 부분 일정(N박M일)과 같고
  // 머리 구간이 다른 일수를 명시하면 머리 구간(공급사 상품 길이)을 쓴다. 다른 쪽 값은 지어내지 않는다.
  if (
    fromDuration.nights != null &&
    fromDuration.days != null &&
    fromTitle.days != null &&
    fromTitle.days !== fromDuration.days &&
    durationHintFromText(titleHeadBeforeHashtag(titleStr)) != null &&
    nightsDaysAppearsOnlyInHashtags(titleStr, fromDuration.nights, fromDuration.days)
  ) {
    tripDays = fromTitle.days
    tripNights = fromTitle.nights
  }

  // REGRESSION-FREEZE[trip-nights-null-not-zero] — DB null은 미확정 유지 (Number(null)=0 금지)
  const dbN = toKnownTripCount(input.tripNights, 0)
  const dbD = toKnownTripCount(input.tripDays, 1)
  if (tripDays == null && dbD != null) tripDays = dbD

  const sched = toKnownTripCount(input.scheduleDayCount, 1)
  if (sched != null && tripDays == null) {
    tripDays = sched
  }

  // DB 0박은 당일(1일)일 때만 신뢰 — 「0박 3일」 같은 모순값은 미확정 처리 (보정·추측 없음)
  if (tripNights == null && dbN != null && (dbN > 0 || tripDays === 1)) tripNights = dbN

  // nights-only·days-only 모두 상대쪽을 발명하지 않음 (공급사 표기만)

  return {
    tripNights,
    tripDays,
    label: formatTripNightsDaysLabel(tripNights, tripDays),
  }
}

/**
 * 비교 매칭 — days·nights 숫자 기준.
 * 한쪽만 nights가 있으면 불일치(「5일」↔「4박 5일」 혼입 방지).
 */
export function compareTripLengthMatch(
  a: DeriveTripNightsDaysInput,
  b: DeriveTripNightsDaysInput,
): boolean {
  const da = deriveTripNightsDays(a)
  const db = deriveTripNightsDays(b)
  if (da.tripDays == null || db.tripDays == null) return false
  if (da.tripDays !== db.tripDays) return false
  if (da.tripNights == null && db.tripNights == null) return true
  if (da.tripNights == null || db.tripNights == null) return false
  return da.tripNights === db.tripNights
}

/**
 * 공개 카드·상세 한 줄 박일 라벨 — 저장 duration을 우선하되, 빈칸이면 제목 머리 구간,
 * 해시태그 누수면 머리 구간. 값 발명 없음(라벨이 없으면 null). DB 쓰기 없음.
 */
export function resolvePublicTripDurationLabel(input: {
  duration?: string | null
  title?: string | null
}): string | null {
  const stored = String(input.duration || '').trim()
  const derived = deriveTripNightsDays({ duration: stored || null, title: input.title ?? null })
  return derived.label ?? (stored || null)
}
