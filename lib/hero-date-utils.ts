/**
 * Hero card "출국일/귀국일" 표시용 날짜 파서/계산 유틸.
 *
 * 운영 규칙:
 * - 날짜만 안정적으로 추출 (시간/요일/괄호 포함 허용)
 * - 표시는 ISO-like `YYYY-MM-DD`로 통일
 */

export function extractIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null

  // 1) 숫자 포맷: 2026-04-20 / 2026.04.20(월) / 2026/4/20 ...
  const m1 = s.match(/(20\d{2})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/)
  if (m1) {
    const y = m1[1]
    const mm = String(m1[2]).padStart(2, '0')
    const dd = String(m1[3]).padStart(2, '0')
    return `${y}-${mm}-${dd}`
  }

  // 2) 한글 포맷: 2026년 4월 20일 / 2026년4월20일(월) ...
  const m2 = s.match(/(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/)
  if (m2) {
    const y = m2[1]
    const mm = String(m2[2]).padStart(2, '0')
    const dd = String(m2[3]).padStart(2, '0')
    return `${y}-${mm}-${dd}`
  }

  return null
}

export function inferTripNights(duration: string | null | undefined): number | null {
  const t = (duration ?? '').trim()
  if (!t) return null

  // 예: "4박 5일"
  const n = t.match(/(\d+)\s*박/)
  if (n) return Number(n[1])

  // 예: "3일" (일 단위면 nights=days-1)
  const d = t.match(/(\d+)\s*일/)
  if (d) {
    const days = Number(d[1])
    if (Number.isFinite(days) && days >= 1) return Math.max(0, days - 1)
  }

  return null
}

/**
 * 히어로 귀국일 = 출발일 + offset일 (항공 leg/raw 미사용).
 * - `N박 M일` → offset = M - 1 (3박4일→3, 4박6일→5)
 * - `N박`만 → N박(N+1)일 가정 → offset = N
 */
export function inferHeroReturnDayOffset(duration: string | null | undefined): number | null {
  const t = (duration ?? '').trim()
  if (!t) return null
  const dayMatch = t.match(/(\d+)\s*일/)
  if (dayMatch) {
    const days = Number(dayMatch[1])
    if (Number.isFinite(days) && days >= 1) return days - 1
  }
  const nightMatch = t.match(/(\d+)\s*박/)
  if (nightMatch) {
    const nights = Number(nightMatch[1])
    if (Number.isFinite(nights) && nights >= 0) return nights
  }
  return null
}

export type HeroTripDateIsoPair = { departureIso: string | null; returnIso: string | null }

/** 달력 선택일 우선, 없으면 첫 예약가능 행 날짜; 귀국은 상품 일정 길이만으로 계산 */
export function computeHeroTripDateIsoPair(opts: {
  selectedDate: string | null
  fallbackPriceRowDate: string | null | undefined
  duration: string | null | undefined
}): HeroTripDateIsoPair {
  const dep =
    opts.selectedDate ??
    (opts.fallbackPriceRowDate && opts.fallbackPriceRowDate.startsWith('20') && opts.fallbackPriceRowDate.length >= 10
      ? opts.fallbackPriceRowDate.slice(0, 10)
      : null)
  const offset = inferHeroReturnDayOffset(opts.duration)
  const ret = dep && offset != null ? addDaysIso(dep, offset) : null
  return { departureIso: dep, returnIso: ret }
}

/** 히어로·견적 카드용: 2026.07.07(화) */
export function formatHeroDateKorean(iso: string | null | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const wk = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()] ?? ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}(${wk})`
}

/**
 * 양력 달력만큼 일수를 더함 (윤년·월말·연말은 JS Date가 처리). timezone 일 밀림 방지로 정오 고정.
 */
export function addDaysIso(baseIso: string, addDays: number): string | null {
  if (!baseIso || !Number.isFinite(addDays)) return null
  const d = new Date(`${baseIso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + addDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** `toIso` − `fromIso` 일수 (양력, 정오 기준). */
export function diffCalendarDaysIso(fromIso: string, toIso: string): number | null {
  if (!fromIso || !toIso) return null
  const d1 = new Date(`${fromIso}T12:00:00`)
  const d2 = new Date(`${toIso}T12:00:00`)
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null
  return Math.round((d2.getTime() - d1.getTime()) / 86400000)
}

/** 본문 전체에서 ISO 형태 날짜를 모아 정렬(중복 제거). 귀국일 후보 추출용. */
export function extractAllIsoDatesSortedUnique(text: string | null | undefined): string[] {
  if (!text?.trim()) return []
  const s = String(text).replace(/\r/g, '\n')
  const out: string[] = []
  const seen = new Set<string>()
  const push = (iso: string | null) => {
    if (!iso || seen.has(iso)) return
    seen.add(iso)
    out.push(iso)
  }
  const reNum = /(20\d{2})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/g
  let m: RegExpExecArray | null
  while ((m = reNum.exec(s))) {
    const y = m[1]
    const mm = String(m[2]).padStart(2, '0')
    const dd = String(m[3]).padStart(2, '0')
    push(`${y}-${mm}-${dd}`)
  }
  const reKor = /(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g
  while ((m = reKor.exec(s))) {
    const y = m[1]
    const mm = String(m[2]).padStart(2, '0')
    const dd = String(m[3]).padStart(2, '0')
    push(`${y}-${mm}-${dd}`)
  }
  return out.sort()
}

const RETURN_CTX_RADIUS = 140

/** 날짜 매치 위치 기준 주변 문맥으로 귀국 후보 점수 (높을수록 귀국일 가능성↑) */
export function scoreReturnDateContext(fullText: string, matchIndex: number, matchLength: number): number {
  const start = Math.max(0, matchIndex - RETURN_CTX_RADIUS)
  const end = Math.min(fullText.length, matchIndex + matchLength + RETURN_CTX_RADIUS)
  const ctx = fullText.slice(start, end)
  let s = 0
  if (/(?:귀국|복귀|귀국일|귀국편|귀국\s*항공)/.test(ctx)) s += 5
  if (/(?:오는\s*편|입국\s*편)/.test(ctx)) s += 3
  if (/(?:인천|김포|김해)\s*(?:국제)?(?:공항)?/.test(ctx) && /(?:도착|입국|착륙)/.test(ctx)) s += 5
  if (/(?:한국\s*도착|국내\s*도착)/.test(ctx)) s += 4
  if (/\binbound\b/i.test(ctx) || /return\s*flight/i.test(ctx)) s += 2
  if (/도착/.test(ctx)) s += 1
  // 출국 전용 구간만 있고 귀국 힌트가 없으면 약한 감점 (첫 일정일 오인 방지)
  if (/(?:가는\s*편|출국\s*편|출국일)/.test(ctx) && !/(?:귀국|복귀|오는\s*편|입국\s*편)/.test(ctx)) s -= 2
  return s
}

export type IsoDateMatch = { iso: string; index: number; length: number }

/** 본문에서 날짜 문자열 매치마다 시작 인덱스·길이 포함 */
export function extractIsoDateMatchesWithIndex(text: string | null | undefined): IsoDateMatch[] {
  if (!text?.trim()) return []
  const s = String(text).replace(/\r/g, '\n')
  const out: IsoDateMatch[] = []
  const push = (iso: string, index: number, length: number) => {
    out.push({ iso, index, length })
  }
  const reNum = /(20\d{2})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/g
  let m: RegExpExecArray | null
  while ((m = reNum.exec(s))) {
    const y = m[1]
    const mm = String(m[2]).padStart(2, '0')
    const dd = String(m[3]).padStart(2, '0')
    push(`${y}-${mm}-${dd}`, m.index, m[0].length)
  }
  const reKor = /(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g
  while ((m = reKor.exec(s))) {
    const y = m[1]
    const mm = String(m[2]).padStart(2, '0')
    const dd = String(m[3]).padStart(2, '0')
    push(`${y}-${mm}-${dd}`, m.index, m[0].length)
  }
  return out
}

/**
 * 출국일 이후(동일일 포함) 날짜 중, 주변 문맥(귀국·인천 도착·오는편 등) 점수가 가장 높은 날짜를 우선.
 * 동점이면 더 늦은 달력일을 택해 기존 "마지막 일정일" 휴리스틱을 보존.
 */
export function pickReturnDateCandidateFromRawText(
  rawBlob: string | null | undefined,
  departureIso: string | null
): string | null {
  if (!rawBlob?.trim() || !departureIso) return null
  const full = String(rawBlob).replace(/\r/g, '\n')
  const matches = extractIsoDateMatchesWithIndex(full)
  const after = matches.filter((x) => x.iso >= departureIso)
  if (after.length === 0) return null

  const scored = after.map((x) => ({
    iso: x.iso,
    score: scoreReturnDateContext(full, x.index, x.length),
  }))
  const maxScore = Math.max(...scored.map((r) => r.score))

  // 귀국 힌트가 하나도 없으면(전부 0 이하): 출국일 이후 가장 늦은 날짜
  if (maxScore <= 0) {
    const sorted = [...new Set(after.map((x) => x.iso))].sort()
    return sorted[sorted.length - 1] ?? null
  }

  const tier = scored.filter((r) => r.score === maxScore)
  return tier.reduce((a, b) => (a.iso > b.iso ? a : b)).iso
}

