/**
 * 관광+자유처럼 공급사 원문 일정(도시·코스)이 정해진 FIT 상품 — 제미나이 추천일정이 원문 도시·코스 밖으로 나가지 않게 한다.
 * 문과장 1101: fit-yb-0017 추천일정에 원문에 없는 옐로스톤·솔트레이크·브라이스가 들어감 → 원문 경로 고정 + 사후 검사.
 * 원문 경로가 없는 일반 에어텔(항공+호텔만)은 이 파일이 아무것도 하지 않는다(기존 동작 그대로).
 * REGRESSION-FREEZE[fit-gemini-original-route-postcheck-1101]: 원문 경로 상품은 원문 밖 장소 금지 — manifest
 */
import type { FitItineraryGeminiResponse } from '@/lib/fit-itinerary-gemini-parse'

export type FitOriginalRouteRow = {
  day: number
  city: string | null
  summaryTextRaw: string | null
  poiNamesRaw?: string | null
  hotelText?: string | null
}

export type FitOriginalRouteDay = {
  day: number
  /** 그날 원문 도시(구간) — 예: ['라스베가스', '캐납'] */
  cities: string[]
  /** 그날 원문 장소·도시 이름 전부(검사용) */
  places: string[]
  /** 원문 문장(프롬프트에 그대로 보여 줌) */
  text: string
  hotelText: string | null
}

const STOP_WORDS = new Set([
  '관광', '관광진행', '진행', '일정', '첫날', '리듬', '자유', '자유관람', '종일', '하루', '구역', '이동', '주변', '차창',
  '귀국', '인천', '출발', '도착', '체크아웃', '체크인', '호텔', '숙박', '테마파크', '외관', '기프트샵', '및', '별도의', '여행',
])

const BOILER = [
  /인천에서\s*출발해/g, /에서\s*도착합니다\.?/g, /를\s*둘러봅니다\.?/g, /을\s*둘러봅니다\.?/g, /를\s*이어서\s*방문합니다\.?/g,
  /을\s*이어서\s*방문합니다\.?/g, /에서\s*종일\s*일정을\s*보냅니다\.?/g, /첫날\s*리듬을\s*맞추며\s*일정을\s*이어갑니다\.?/g,
  /테마파크\s*구역을\s*오가며\s*하루를\s*이어갑니다\.?/g, /에서\s*주변을\s*이어서\s*둘러봅니다\.?/g, /으로\s*이동,?/g,
  /별도의\s*관광보다\s*이동\s*중심으로\s*여행을\s*마무리합니다\.?/g, /체크아웃\s*후\s*인천으로\s*귀국합니다\.?/g,
]

/** 표기 흔들림만 맞춘다(라스베가스/라스베이거스, 캐년/캐니언, 유니버셜/유니버설, 원문 OCR '랜드캐년'). */
export function normalizeOriginalRoutePlace(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/캐니언/g, '캐년')
    .replace(/베이거스/g, '베가스')
    .replace(/유니버셜/g, '유니버설')
    .replace(/(^|[^그])랜드캐년/g, '$1그랜드캐년')
    .replace(/[\s·\-–_,.()'"’]/g, '')
}

function splitPlaces(s: string): string[] {
  let t = String(s ?? '')
  for (const re of BOILER) t = t.replace(re, ',')
  return t
    .split(/[·,\/]|\s-\s|\s및\s|와\s|과\s|,|\n/)
    .map((x) =>
      x
        .replace(/\s*(를|을|와|과|에서|으로|로)$/u, '')
        .replace(/\s*(또는\s*동급)$/u, '')
        .replace(/\s*(자유관람|관광|차창|외관)$/u, '')
        .trim(),
    )
    .filter((x) => x.length >= 2 && !STOP_WORDS.has(x.replace(/\s+/g, '')))
}

/**
 * 원문 일정이 '정해진 코스'인지 — 관광+자유 상품이고, 원문 일차 절반 이상에 도시가 있고, 서로 다른 도시가 3곳 이상.
 * 항공+호텔만 있는 상품(원문 도시 1~2개, 빈 일차 다수)은 false → 기존처럼 제미나이가 자유롭게 짠다.
 */
export function isFitOriginalRouteTitle(productTitle: string | null | undefined): boolean {
  return /관광\s*\+\s*자유|관광\s*포함\s*자유/u.test(String(productTitle ?? ''))
}

export function buildFitOriginalRoute(
  productTitle: string | null | undefined,
  rows: FitOriginalRouteRow[],
  totalDays: number,
): FitOriginalRouteDay[] | null {
  if (!isFitOriginalRouteTitle(productTitle)) return null
  const sorted = [...rows].filter((r) => Number.isFinite(r.day)).sort((a, b) => a.day - b.day)
  const withCity = sorted.filter((r) => String(r.city ?? '').trim() && !/^귀국$/.test(String(r.city).trim()))
  if (withCity.length < Math.ceil(totalDays / 2)) return null
  const distinct = new Set(withCity.flatMap((r) => splitPlaces(r.city ?? '')).map(normalizeOriginalRoutePlace))
  if (distinct.size < 3) return null
  return sorted.map((r) => {
    const cities = splitPlaces(r.city ?? '')
    const places = [...new Set([...cities, ...splitPlaces(r.summaryTextRaw ?? ''), ...splitPlaces(r.poiNamesRaw ?? '')])]
    const text = [r.city, r.summaryTextRaw].map((x) => String(x ?? '').trim()).filter(Boolean).join(' — ')
    const hotel = String(r.hotelText ?? '').replace(/^HOTEL\s*:\s*/i, '').trim()
    return { day: r.day, cities, places, text, hotelText: hotel || null }
  })
}

/** 프롬프트 블록 — '공급사 일정표를 쓰지 않습니다' 줄 대신 들어간다. */
export function buildFitOriginalRoutePromptBlock(route: FitOriginalRouteDay[]): string {
  const lines = route.map(
    (d) => `  · ${d.day}일차: ${d.text || '(원문 없음)'}${d.hotelText ? ` / 숙박: ${d.hotelText}` : ' / 숙박 없음'}`,
  )
  return `- 공급사 원문 일정(코스 고정 — 이 상품은 관광+자유라 도시·코스가 정해져 있습니다):
${lines.join('\n')}
- 원문 코스 규칙(반드시 지킴):
  · 각 일차는 위 같은 일차의 도시·장소 안에서만 짭니다. 원문에 없는 도시·국립공원·명소(다른 주·다른 지역)는 넣지 않습니다.
  · 원문 순서와 이동 방향을 바꾸지 않습니다. 일차를 앞당기거나 미루지 않습니다.
  · attraction·shopping 활동마다 title이나 location에 그날 원문 도시·장소 이름을 한국어로 넣습니다(예: '샌프란시스코 피셔맨스 워프', '요세미티 폭포 (Yosemite Falls)').
  · 원문 장소가 있는 날은 그 장소를 중심으로, 원문이 도시뿐인 날은 그 도시 안 장소만 고릅니다.
  · 원문에 도시 이름만 있는 날(자유일)은 원문에 없는 새 명소를 넣지 않습니다. activity는 '샌프란시스코 시내 자유 시간'처럼 도시 이름으로 씁니다.
  · 원문에 '귀국'만 있는 날은 체크아웃 → 공항만 씁니다. 이날 activities는 transport·hotel만 쓰고 attraction·shopping은 넣지 않습니다(공항도 attraction 아님). 이 규칙이 아래 '출국하는 날도 attraction 한 곳 이상' 규칙보다 우선합니다.
  · 호텔 이름은 원문 숙박 칸에 있는 이름만, '또는 동급'을 붙여 씁니다. 지어내지 않습니다.`
}

/**
 * 사후 검사 — 원문 경로 상품에서 attraction·shopping 활동이 그날(또는 전날 밤 묵은 도시) 원문 도시·장소를 하나도 말하지 않으면 실패.
 * 실패하면 호출부가 한 번 더 부르고, 그래도 안 되면 저장하지 않는다(기존 validation_failed 흐름).
 */
export function checkFitItineraryWithinOriginalRoute(
  parsed: FitItineraryGeminiResponse,
  route: FitOriginalRouteDay[] | null,
): string[] {
  if (!route?.length) return []
  const issues: string[] = []
  const byDay = new Map(route.map((d) => [d.day, d]))
  for (const d of parsed.days ?? []) {
    const n = Math.floor(Number(d.dayNumber))
    const today = byDay.get(n)
    if (!today) continue
    const prev = byDay.get(n - 1)
    const allowed = [...today.places, ...(prev?.cities.slice(-1) ?? [])]
      .map(normalizeOriginalRoutePlace)
      .filter((x) => x.length >= 2)
    const returnOnly = !today.cities.length || /^귀국/.test(today.text)
    for (const a of d.activities ?? []) {
      const cat = String(a.category ?? '')
      if (cat !== 'attraction' && cat !== 'shopping') continue
      if (returnOnly) {
        issues.push(`day${n}_return_day_has_${cat}`)
        continue
      }
      const hay = normalizeOriginalRoutePlace(`${a.title ?? ''} ${a.location ?? ''}`)
      if (!allowed.some((p) => hay.includes(p))) issues.push(`day${n}_outside_original_route`)
    }
  }
  return [...new Set(issues)]
}
