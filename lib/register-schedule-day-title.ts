/**
 * 일정 일차 title(전체일정요약 헤드라인) — 정제된 routeText 기반 짧은 한 줄.
 * routeText 전체 복붙·`N일차`만 남는 폴백을 줄인다.
 * REGRESSION-FREEZE[register-schedule-day-title-ssot]: short title from route — manifest
 */

const TITLE_MAX_CHARS = 48

function clipRegisterScheduleDayTitle(s: string, max = TITLE_MAX_CHARS): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return t
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}

function splitRouteTitleSegments(routeText: string | null | undefined): string[] {
  return String(routeText ?? '')
    .split(/\s*-\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function isHubOrReturnSegment(seg: string): boolean {
  return /^(?:인천|김포|귀국|출국|공항|ICN|GMP)(?:\s|$)/u.test(seg) || /귀국|출국/.test(seg)
}

/**
 * routeText → 짧은 title. 세그먼트가 2개 이상이면 `첫 · 끝`.
 * 귀국일·빈 route는 returnTitle / fallbacks / `N일차`.
 */
export function composeRegisterScheduleDayTitleFromRoute(opts: {
  day: number
  maxDay: number
  routeText?: string | null
  fallbacks?: Array<string | null | undefined>
  /** 예: 귀국, 숙박 없음(귀국) */
  returnTitle?: string
}): string {
  const { day, maxDay } = opts
  const segs = splitRouteTitleSegments(opts.routeText)

  const returnish =
    day === maxDay &&
    maxDay >= 2 &&
    (segs.length === 0 || segs.every(isHubOrReturnSegment))

  if (returnish && opts.returnTitle) {
    return clipRegisterScheduleDayTitle(opts.returnTitle)
  }

  if (segs.length >= 2) {
    const head = segs[0]!
    const tail = segs[segs.length - 1]!
    if (head === tail) return clipRegisterScheduleDayTitle(head)
    return clipRegisterScheduleDayTitle(`${head} · ${tail}`)
  }
  if (segs.length === 1) return clipRegisterScheduleDayTitle(segs[0]!)

  for (const f of opts.fallbacks ?? []) {
    const t = String(f ?? '').trim()
    if (t) return clipRegisterScheduleDayTitle(t)
  }
  return `${day}일차`
}
