/**
 * 등록 파싱: 대표 목적지(destination) vs 항공 첫 도착·일정 1일차·귀국편 출발 — 정합성 힌트.
 * 오픈조·다도시 패키지에서 문자상 불일치가 흔하므로 warn이 아닌 info 중심.
 */
import type { FlightStructured } from '@/lib/detail-body-parser'

/** register-parse.RegisterExtractionFieldIssue 와 동형 — 순환 import 방지 */
export type DestinationFieldIssue = {
  field: string
  reason: string
  source: 'auto' | 'manual' | 'llm'
  severity: 'info' | 'warn'
}

export type ScheduleDayLite = {
  day: number
  title: string
  description: string
  hotelText?: string | null
}

const OPEN_JAW_NOTE =
  '오픈조·다도시 패키지(A→B 입국 후 여러 도시 경유, C→A 귀국 등)에서는 대표 목적지·요약 문구와 첫 입국/최종 출국 도시가 달라도 정상인 경우가 많습니다.'

/** 대표 목적지가 국가·권역이고 항공 도시가 그 권역 내 도시인 경우 — 문자 불일치 info 생략 */
const REP_REGION_ENCOMPASSES_CITY: Array<{ rep: RegExp; cities: RegExp }> = [
  {
    rep: /^(?:튀르키예|터키|Turkey|Türkiye|Turkiye)$/i,
    cities: /이스탄불|Istanbul|카파도키아|Cappadocia|안탈리아|Antalya|파묵칼레|Pamukkale|에페소|Ephesus|콘야|보드룸|카트마뉴|페르가몬/i,
  },
  {
    rep: /^(?:일본|Japan)$/i,
    cities: /도쿄|Tokyo|오사카|Osaka|교토|Kyoto|삿포로|후쿠오카|나고야|오키나와|홋카이도|규슈|北海道/i,
  },
  {
    rep: /^(?:태국|Thailand)$/i,
    cities: /방콕|Bangkok|푸켓|Phuket|치앙마이|Chiang\s*Mai|파타야|Pattaya|크라비|Krabi/i,
  },
  {
    rep: /^(?:베트남|Vietnam)$/i,
    cities: /하노이|Hanoi|호치민|Ho\s*Chi\s*Minh|다낭|Danang|나트랑|Nha\s*Trang|푸꾸옥|Phu\s*Quoc/i,
  },
]

function scheduleFullHaystack(schedule: ScheduleDayLite[]): string {
  return schedule
    .map((s) => [s.title, s.description, s.hotelText ?? ''].filter(Boolean).join('\n'))
    .join('\n')
}

/** 권역·국가 대표 목적지 vs 입국·출국 도시(이스탄불 등) — 정상 다도시 패키지 */
function representativeEncompassesFlightPlace(
  rep: string,
  place: string | null,
  schedule: ScheduleDayLite[]
): boolean {
  if (!rep.trim() || !place) return false
  const p = compactPlace(place)
  if (p.length < 2) return false
  const repTrim = rep.replace(/\s+/g, ' ').trim()
  for (const { rep: repRe, cities } of REP_REGION_ENCOMPASSES_CITY) {
    if (repRe.test(repTrim) && cities.test(p)) return true
  }
  const hay = scheduleFullHaystack(schedule)
  if (hay.trim() && scheduleMentionsPlace(hay, repTrim) && scheduleMentionsPlace(hay, p)) {
    if (!placeTokensOverlap(repTrim, p)) return true
  }
  return false
}

function compactPlace(s: string | null | undefined): string {
  if (s == null) return ''
  return String(s)
    .trim()
    .replace(/(?:국제)?공항$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 한글·라틴 토큰이 서로 포함되거나 공통 구간이 있으면 true (짧은 노이즈 제외) */
export function placeTokensOverlap(a: string, b: string): boolean {
  const x = compactPlace(a).toLowerCase()
  const y = compactPlace(b).toLowerCase()
  if (x.length < 2 || y.length < 2) return false
  if (x.includes(y) || y.includes(x)) return true
  for (const part of x.split(/[/／|·,，]/)) {
    const p = part.trim()
    if (p.length >= 2 && y.includes(p)) return true
  }
  for (const part of y.split(/[/／|·,，]/)) {
    const p = part.trim()
    if (p.length >= 2 && x.includes(p)) return true
  }
  return false
}

function scheduleMentionsPlace(scheduleBlob: string, place: string | null): boolean {
  if (!place || !scheduleBlob.trim()) return false
  const p = compactPlace(place)
  if (p.length < 2) return false
  const blob = scheduleBlob.replace(/\s+/g, '')
  const pp = p.replace(/\s+/g, '')
  if (blob.includes(pp)) return true
  return pp.split(/[/／|]/).some((seg) => seg.trim().length >= 2 && blob.includes(seg.trim()))
}

function day1Haystack(schedule: ScheduleDayLite[]): string {
  const sorted = [...schedule].filter((s) => Number(s.day) >= 1).sort((a, b) => Number(a.day) - Number(b.day))
  const d1 = sorted.find((s) => Number(s.day) === 1) ?? sorted[0]
  if (!d1) return ''
  return [d1.title, d1.description, d1.hotelText ?? ''].filter(Boolean).join('\n')
}

function firstArrivalPlace(flight: FlightStructured): string | null {
  const v = compactPlace(flight.outbound.arrivalAirport)
  return v || null
}

function finalDeparturePlace(flight: FlightStructured): string | null {
  const v = compactPlace(flight.inbound.departureAirport)
  return v || null
}

function repDiffersFromPlace(rep: string, place: string | null): boolean {
  if (!rep.trim() || !place) return false
  return !placeTokensOverlap(rep, place)
}

/**
 * LLM·기존 이슈 중 목적지·일정 정합성으로 보이는 항목: 심각도 완화 및 오픈조 안내 문구 보강.
 * field `destination.*` 는 건드리지 않음(본 모듈이 추가한 결정적 이슈).
 */
export function normalizeDestinationExtractionIssuesInPlace(issues: DestinationFieldIssue[]): void {
  const OPEN = `(${OPEN_JAW_NOTE})`
  for (const it of issues) {
    if (it.field.startsWith('destination.')) continue

    const f = it.field.toLowerCase()
    const r = it.reason
    const isDestScoped =
      f === 'destination' ||
      f.includes('목적지') ||
      f.includes('itinerary') ||
      (f.includes('schedule') && !f.includes('inbound')) ||
      (f.includes('일정') && !f.includes('귀국'))

    if (!isDestScoped) continue

    if (
      it.source === 'llm' &&
      it.severity === 'warn' &&
      /목적지|destination|일정|여정|일치|다름|불일치|상이|입국|도착|첫|도시|경로/i.test(`${it.field} ${r}`) &&
      !/필수|필수입력|REVIEW\s*REQUIRED|누락|비어\s*있|없습니다/i.test(r)
    ) {
      it.severity = 'info'
    }

    if (
      /일정.*목적지|목적지.*일정|요약.*일정|요약\s*여정|첫\s*입국|첫.*도시|대표.*목적지|destination.*schedule|schedule.*destination/i.test(
        r
      ) &&
      !r.includes('오픈조') &&
      !r.includes('다도시')
    ) {
      it.reason = `${r} ${OPEN}`.trim()
    }
  }
}

/**
 * 결정적 힌트: 대표 목적지 vs 항공·1일차. 항공↔일정이 맞으면 대표 목적지 차이는 info만.
 */
export function buildDestinationCoherenceFieldIssues(opts: {
  representativeDestination: string
  schedule: ScheduleDayLite[]
  flight: FlightStructured
}): DestinationFieldIssue[] {
  const issues: DestinationFieldIssue[] = []
  const rep = opts.representativeDestination.trim()
  if (!rep) return issues

  const firstArr = firstArrivalPlace(opts.flight)
  const finalDep = finalDeparturePlace(opts.flight)
  const day1 = day1Haystack(opts.schedule)

  const hasFlightEndpoints = Boolean(firstArr || finalDep)
  if (!hasFlightEndpoints) return issues

  const scheduleAlignedWithFirstArrival =
    Boolean(firstArr) &&
    (scheduleMentionsPlace(day1, firstArr) || placeTokensOverlap(day1, firstArr ?? ''))

  if (scheduleAlignedWithFirstArrival && firstArr) {
    if (repDiffersFromPlace(rep, firstArr) && !representativeEncompassesFlightPlace(rep, firstArr, opts.schedule)) {
      issues.push({
        field: 'destination.representative_vs_first_arrival',
        reason: `대표 목적지·요약("${rep}")와 항공 첫 도착(추정 "${firstArr}") 문자상 다릅니다. 1일차 일정·항공 도착은 서로 맞는 것으로 보이며, 대표 목적지는 상품명·권역·마케팅용으로 따로 잡히는 경우가 많습니다. ${OPEN_JAW_NOTE} 문구만 필요 시 확인하세요.`,
        source: 'auto',
        severity: 'info',
      })
    }
  } else {
    if (
      firstArr &&
      repDiffersFromPlace(rep, firstArr) &&
      !representativeEncompassesFlightPlace(rep, firstArr, opts.schedule)
    ) {
      issues.push({
        field: 'destination.representative_vs_first_arrival',
        reason: `대표 목적지·요약("${rep}")와 항공 가는편 첫 도착(추정 "${firstArr}")이 문자상 다릅니다. ${OPEN_JAW_NOTE} 실제 첫 체류 도시는 항공·일정표 원문을 기준으로 확인하세요.`,
        source: 'auto',
        severity: 'info',
      })
    }
    if (firstArr && day1.trim() && !scheduleMentionsPlace(day1, firstArr) && !placeTokensOverlap(day1, firstArr)) {
      issues.push({
        field: 'destination.schedule_day1_vs_first_arrival',
        reason: `1일차 일정 텍스트와 항공 첫 도착(추정 "${firstArr}")이 문자상 어긋납니다. 공항 이동·당일 이동만 있는 1일차면 정상일 수 있습니다. ${OPEN_JAW_NOTE} 일정표·항공 블록을 대조해 주세요.`,
        source: 'auto',
        severity: 'info',
      })
    }
  }

  if (
    finalDep &&
    repDiffersFromPlace(rep, finalDep) &&
    !representativeEncompassesFlightPlace(rep, finalDep, opts.schedule)
  ) {
    issues.push({
      field: 'destination.representative_vs_final_departure',
      reason: `대표 목적지("${rep}")와 귀국편 출발 도시(추정 "${finalDep}")가 문자상 다릅니다. 지역 순회·오픈조에서 흔합니다. ${OPEN_JAW_NOTE}`,
      source: 'auto',
      severity: 'info',
    })
  }

  return issues
}
