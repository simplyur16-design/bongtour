/**
 * 일정 일차 title(전체일정요약 헤드라인) — 정제된 routeText 기반 짧은 한 줄.
 * routeText 전체 복붙·`N일차`만 남는 폴백을 줄인다.
 * REGRESSION-FREEZE[register-schedule-day-title-ssot]: short title from route — manifest
 */

import {
  isRegisterScheduleDomesticHubRouteSegment,
  isRegisterScheduleRoutePlaceNoise,
} from '@/lib/register-schedule-route-place-noise'

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

/** 주의사항·행정 안내를 title 폴백으로 쓰지 않음 */
function isRegisterScheduleDayTitleNoise(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (/^\d+\s*일차$/.test(t)) return true
  return /주의사항|※|안전사고|자유시간\s*시|개별적으로\s*진행|여행\s*준비\s*가이드|타사\s*비교|비즈니스\s*석|포함\s*일정|필수\s*준비/u.test(
    t,
  )
}

/** 자유일·리조트·무숙박 라벨 — 지명 noise여도 title로 유지 (기존 동작) */
function isRegisterScheduleDayTitleKeepLabel(seg: string): boolean {
  return /자유\s*(?:시간|일정|휴양)|리조트|체크\s*아웃|숙박\s*없음/u.test(seg)
}

/** 폴백 title — 공지·요금·기내박 문구 금지 (짧은 일반 문구 폴백은 유지) */
function isRegisterScheduleNoticeTitleFallback(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (isRegisterScheduleDayTitleKeepLabel(t)) return false
  return t.length <= 96 && isRegisterScheduleRoutePlaceNoise(t) && /전자\s*담배|보호자로|공지|원\s*\/\s*인|\d\s*인\s*\/?\s*\d\s*실|참고\s*사항|기내박|니다[.!]?$|위약금|특약|수칙|다운로드/u.test(t)
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
  const ownSegs = splitRouteTitleSegments(opts.routeText).filter((s) => !isRegisterScheduleDayTitleNoise(s))
  // REGRESSION-FREEZE[display-text-fix-1031]: title도 routeText 지명 noise·국내 허브 제외 (공지·000원/인 제목 금지) — manifest
  const placeSegs = ownSegs.filter(
    (s) => isRegisterScheduleDayTitleKeepLabel(s) || !isRegisterScheduleRoutePlaceNoise(s),
  )
  const nonHubSegs = placeSegs.filter((s) => !isRegisterScheduleDomesticHubRouteSegment(s))
  const segs = nonHubSegs.length > 0 ? nonHubSegs : placeSegs

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
    if (t && !isRegisterScheduleDayTitleNoise(t) && !isRegisterScheduleNoticeTitleFallback(t)) {
      return clipRegisterScheduleDayTitle(t)
    }
  }
  return `${day}일차`
}
