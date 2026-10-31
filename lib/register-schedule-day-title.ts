/**
 * 일정 일차 title(전체일정요약 헤드라인) — 정제된 routeText 기반 짧은 한 줄.
 * routeText 전체 복붙·`N일차`만 남는 폴백을 줄인다.
 * REGRESSION-FREEZE[register-schedule-day-title-ssot]: short title from route — manifest
 */

import {
  isRegisterScheduleDomesticHubRouteSegment,
  isRegisterScheduleRoutePlaceNoise,
} from '@/lib/register-schedule-route-place-noise'
import {
  isRegisterScheduleInFlightNightLabel,
  registerScheduleTextMentionsInFlightNight,
} from '@/lib/register-schedule-hotel-inflight'

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

/**
 * 자유일·리조트 휴양·무숙박 라벨 — 지명 noise여도 title로 유지 (기존 동작).
 * 리조트 **이름**(`두짓타니 막탄 세부 리조트`)은 숙소이므로 유지 대상이 아니다 — `리조트 자유/휴양/휴식`만.
 */
function isRegisterScheduleDayTitleKeepLabel(seg: string): boolean {
  return /자유\s*(?:시간|일정|휴양)|^리조트$|리조트\s*(?:내\s*|에서\s*)?(?:자유|휴양|휴식)|체크\s*아웃|숙박\s*없음/u.test(
    seg,
  )
}

/**
 * 숙소명·주소·기내박 — 일차 title 폴백으로 쓰지 않는다 (title=호텔 주소/리조트명 회귀 차단).
 * 루트가 전부 noise로 걸러진 출발일에 `fallbacks: [..., d.hotels[0]]` 가 그대로 제목이 되던 문제의 공통 차단점.
 * REGRESSION-FREEZE[register-schedule-day-title-ssot]: no lodging title fallback — manifest
 */
export function isRegisterScheduleLodgingLikeTitleLabel(text: string | null | undefined): boolean {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return false
  if (/자유\s*(?:시간|일정|휴양)|체크\s*아웃|^숙박\s*없음|리조트\s*(?:내\s*|에서\s*)?(?:자유|휴양|휴식)/u.test(t)) {
    return false
  }
  if (isRegisterScheduleInFlightNightLabel(t) || registerScheduleTextMentionsInFlightNight(t)) return true
  if (/\b(?:ADD|ADDRESS|TEL|PHONE|FAX)\s*[:：]|\/\/|\+\d{1,3}\s*\(?\d/iu.test(t)) return true
  if (/\b(?:hotel|hotels|resort|resorts|inn|hostel|suites?|residences?|lodge|ryokan|motel|guest\s*house)\b/iu.test(t)) {
    return true
  }
  if (/호텔|리조트|호스텔|레지던스|게스트\s*하우스|료칸|모텔|숙소|숙박|투숙|동급/u.test(t)) return true
  return false
}

/** 정규화 키 — 공백·구두점 제거 */
function titlePairKey(s: string): string {
  return s.replace(/[\s·,，()（）\[\]]/gu, '').toLowerCase()
}

/**
 * `A · B` 결합 — 같은 말, 긴 문구(8자+) 포함, 띄어쓴 낱말 포함이면 긴 쪽 하나만 (제목 중복 회귀 차단).
 * 도시 + 그 도시 랜드마크(`오사카 · 오사카성`)는 그대로 둔다.
 * 예: `앙코르와트 국제 하프 마라톤 입국 · 앙코르와트 국제 하프 마라톤 입국` → 한 번만.
 * REGRESSION-FREEZE[register-schedule-day-title-ssot]: no duplicated title pair — manifest
 */
export function joinRegisterScheduleDayTitlePair(
  a: string | null | undefined,
  b: string | null | undefined,
): string {
  const x = String(a ?? '').replace(/\s+/g, ' ').trim()
  const y = String(b ?? '').replace(/\s+/g, ' ').trim()
  if (!x) return y
  if (!y) return x
  const kx = titlePairKey(x)
  const ky = titlePairKey(y)
  if (!kx) return y
  if (!ky) return x
  if (kx === ky) return x
  // 짧은 도시명 + 그 도시 랜드마크(`오사카 · 오사카성`)는 의도된 짝이다.
  // 포함 접기는 (1) 긴 문구(8자+) 중복, (2) 짧은 쪽이 긴 쪽의 띄어쓴 낱말일 때(`파리 · 파리 시내`)만.
  const PAIR_CONTAIN_MIN = 8
  const hasWord = (long: string, short: string) =>
    long.split(/[\s·,，()（）\[\]]+/u).some((w) => titlePairKey(w) === short)
  if (kx.includes(ky) && (ky.length >= PAIR_CONTAIN_MIN || hasWord(x, ky))) return x
  if (ky.includes(kx) && (kx.length >= PAIR_CONTAIN_MIN || hasWord(y, kx))) return y
  return `${x} · ${y}`
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
    return clipRegisterScheduleDayTitle(joinRegisterScheduleDayTitlePair(head, tail))
  }
  if (segs.length === 1) return clipRegisterScheduleDayTitle(segs[0]!)

  for (const f of opts.fallbacks ?? []) {
    const t = String(f ?? '').trim()
    if (
      t &&
      !isRegisterScheduleDayTitleNoise(t) &&
      !isRegisterScheduleNoticeTitleFallback(t) &&
      !isRegisterScheduleLodgingLikeTitleLabel(t)
    ) {
      return clipRegisterScheduleDayTitle(t)
    }
  }
  return `${day}일차`
}
