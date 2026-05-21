/**
 * 일정 schedule[].imageKeyword / imageKeyword2 — 전 공급사 LLM·선추출 공통 SSOT.
 * - 관광 일차: 그날 주요 관광지·관광명소 1순위·2순위(영문 고유명)
 * - 출발·귀국 일차에 국내 허브(인천·김포·부산·대구·청주 등): 첫·마지막 해외 도시 영문명
 */
import { applyDualScheduleImageKeywordsToRows } from '@/lib/schedule-dual-image-keyword'
import {
  extractPlaceNameKeyword,
  finalizeScheduleImageKeyword,
  isBareCityOrCountryKeyword,
  isLikelyTourismLandmarkKeyword,
} from '@/lib/pexels-place-name-keyword'
import { extractPrimaryEnglishPlaceName } from '@/lib/english-schedule-place-extract'
import { firstPoiSearchTermExcluding, mapKoreanPoiSegment, normalizeSemanticPoiKey } from '@/lib/pexels-keyword'

/** REGISTER_PROMPT·schedule 선추출 프롬프트에 삽입 */
export const REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK = `# [schedule[].imageKeyword / imageKeyword2 — Pexels 검색용]
- **관광 일차:** 그날 일정 본문에 나오는 **관광명소·랜드마크**만(예: Yu Garden, West Lake, The Bund). **도시·국가 영문명 단독 금지**(Shanghai, Beijing, Tokyo 등). imageKeyword = 1순위 명소, imageKeyword2 = 다른 명소. Day N travel·한글·공항·호텔·식사 금지.
- **출발·귀국(비행) 일차:** imageKeyword·imageKeyword2 모두 **일정 첫·마지막 해외 도시 영문명**만(동일 도시 가능). 국내 허브·공항 키워드 금지.
- 불확실한 슬롯은 빈 문자열.`

export const REGISTER_SCHEDULE_EXTRACT_IMAGE_KEYWORD_LINE =
  'imageKeyword(1순위 관광지·명소), imageKeyword2(2순위 관광지·명소 또는 비행일 도시명),'

const KOREAN_HUB_RE =
  /인천|김포|부산|대구|청주|김해|서울|제주|ICN|GMP|PUS|TAE|CJJ|CJU|인천국제공항|김포국제공항|김해국제공항/u

const DEPARTURE_DAY_RE = /출발|출국|탑승|공항\s*(?:이동|출발)|이동\s*·\s*탑승/u
const ARRIVAL_DAY_RE = /귀국|입국|도착|귀국편|입국편|현지\s*출발.*귀국/u

/** 긴 키 우선 — 부분 매칭 */
const KO_CITY_TO_EN: ReadonlyArray<{ re: RegExp; en: string }> = [
  { re: /홍콩|香港/u, en: 'Hong Kong' },
  { re: /마카오|澳門/u, en: 'Macau' },
  { re: /타이베이|台北/u, en: 'Taipei' },
  { re: /상해|사해|上海/u, en: 'Shanghai' },
  { re: /북경|베이징|北京/u, en: 'Beijing' },
  { re: /광저우|广州/u, en: 'Guangzhou' },
  { re: /심천|深圳/u, en: 'Shenzhen' },
  { re: /도쿄|東京/u, en: 'Tokyo' },
  { re: /오사카|大阪/u, en: 'Osaka' },
  { re: /교토|京都/u, en: 'Kyoto' },
  { re: /후쿠오카|福岡/u, en: 'Fukuoka' },
  { re: /삿포로|札幌/u, en: 'Sapporo' },
  { re: /나고야|名古屋/u, en: 'Nagoya' },
  { re: /요코하마|横浜/u, en: 'Yokohama' },
  { re: /다낭/u, en: 'Da Nang' },
  { re: /하노이/u, en: 'Hanoi' },
  { re: /호치민|사이공/u, en: 'Ho Chi Minh City' },
  { re: /방콕/u, en: 'Bangkok' },
  { re: /치앙마이/u, en: 'Chiang Mai' },
  { re: /파타야/u, en: 'Pattaya' },
  { re: /푸켓/u, en: 'Phuket' },
  { re: /세부/u, en: 'Cebu' },
  { re: /보라카이/u, en: 'Boracay' },
  { re: /발리/u, en: 'Bali' },
  { re: /싱가포르/u, en: 'Singapore' },
  { re: /쿠알라룸푸르/u, en: 'Kuala Lumpur' },
  { re: /파리/u, en: 'Paris' },
  { re: /로마/u, en: 'Rome' },
  { re: /바르셀로나/u, en: 'Barcelona' },
  { re: /런던/u, en: 'London' },
  { re: /뉴욕/u, en: 'New York' },
  { re: /시드니/u, en: 'Sydney' },
  { re: /멜버른|멜번/u, en: 'Melbourne' },
  { re: /호주|호놀룰루|하와이|Honolulu/i, en: 'Honolulu' },
  { re: /괌|Guam/i, en: 'Guam' },
  { re: /사이판|Saipan/i, en: 'Saipan' },
  { re: /두바이/u, en: 'Dubai' },
  { re: /이스탄불/u, en: 'Istanbul' },
  { re: /부다페스트/u, en: 'Budapest' },
  { re: /프라하/u, en: 'Prague' },
  { re: /비엔나/u, en: 'Vienna' },
  { re: /취리히/u, en: 'Zurich' },
  { re: /백두산|장가계|계림|성도|곤명|여강|하이난/u, en: 'China' },
]

/** 관광 일차 — 본문에서 명소 추출(긴 패턴 우선) */
const KO_LANDMARK_RULES: ReadonlyArray<{ re: RegExp; en: string }> = [
  { re: /유니버설|USJ/u, en: 'Universal Studios Japan' },
  { re: /(?:유|우)원|豫园|예원/u, en: 'Yu Garden' },
  { re: /외탄|外滩|와탄/u, en: 'The Bund' },
  { re: /난징\s*로|南京路/u, en: 'Nanjing Road' },
  { re: /신천지|新天地/u, en: 'Xintiandi' },
  { re: /동방명주|东方明珠/u, en: 'Oriental Pearl Tower' },
  { re: /주가각|朱家角/u, en: 'Zhujiajiao' },
  { re: /우캉\s*루|武康路/u, en: 'Wukang Road' },
  { re: /항주|杭州|서호|西湖/u, en: 'West Lake' },
  { re: /송성|宋城|송가무|가무쇼/u, en: 'Songcheng Park' },
  { re: /청황|城隍/u, en: 'City God Temple of Shanghai' },
  { re: /자금성|故宫/u, en: 'Forbidden City' },
  { re: /톈안먼|天安门/u, en: 'Tiananmen Square' },
  { re: /금각사|金閣寺/u, en: 'Kinkaku-ji' },
  { re: /후시미\s*이나리|伏見稲荷/u, en: 'Fushimi Inari' },
  { re: /도톤보리|道頓堀/u, en: 'Dotonbori' },
  { re: /바나힐|골든브릿지/u, en: 'Ba Na Hills' },
  { re: /호이안/u, en: 'Hoi An Ancient Town' },
]

/** 본문에 명소가 없고 도시만 언급될 때 최후 폴백(도시명 단독 대신 대표 명소) */
const CITY_ICONIC_LANDMARK: Record<string, string> = {
  shanghai: 'The Bund',
  beijing: 'Forbidden City',
  hangzhou: 'West Lake',
  guangzhou: 'Canton Tower',
  shenzhen: 'Splendid China Folk Village',
  tokyo: 'Sensoji Temple',
  osaka: 'Osaka Castle',
  kyoto: 'Fushimi Inari',
  'hong kong': 'Victoria Peak',
  taipei: 'Taipei 101',
  bangkok: 'Wat Arun',
  'da nang': 'Marble Mountains',
  paris: 'Eiffel Tower',
  rome: 'Colosseum',
  london: 'Tower Bridge',
  barcelona: 'Sagrada Familia',
}

const KO_HUB_EN = new Set([
  'incheon',
  'gimpo',
  'busan',
  'daegu',
  'cheongju',
  'gimhae',
  'seoul',
  'jeju',
])

export type ScheduleImageKeywordDayInput = {
  day: number
  title?: string | null
  description?: string | null
  routeText?: string | null
}

export type ScheduleImageKeywordPlan = {
  firstDestinationEn: string
  lastDestinationEn: string
  totalDays: number
}

function hay(ctx: ScheduleImageKeywordDayInput): string {
  return `${ctx.title ?? ''}\n${ctx.description ?? ''}\n${ctx.routeText ?? ''}`.replace(/\s+/g, ' ')
}

function hasKoreanHub(text: string): boolean {
  return KOREAN_HUB_RE.test(text)
}

function koSegmentToEnCity(segment: string): string | null {
  const t = segment.trim()
  if (!t || t.length < 2) return null
  if (KOREAN_HUB_RE.test(t) && t.length <= 8) return null
  for (const { re, en } of KO_CITY_TO_EN) {
    if (re.test(t)) return en
  }
  const poi = mapKoreanPoiSegment(t)
  if (poi) {
    const first = poi.split(/\s+/)[0]
    if (first && /^[A-Z]/.test(first)) return first
  }
  if (/^[A-Za-z][A-Za-z\s-]{2,}$/.test(t)) {
    const w = t.split(/\s+/).slice(0, 5).join(' ')
    return w
  }
  return null
}

function collectDestinationCitiesEn(rows: ScheduleImageKeywordDayInput[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (en: string | null) => {
    if (!en) return
    const key = en.toLowerCase()
    if (KO_HUB_EN.has(key)) return
    if (seen.has(key)) return
    seen.add(key)
    out.push(en)
  }
  for (const row of rows) {
    const rt = (row.routeText ?? '').trim()
    if (rt) {
      for (const seg of rt.split(/\s*-\s*/)) {
        push(koSegmentToEnCity(seg))
      }
    }
    const h = hay(row)
    for (const { re, en } of KO_CITY_TO_EN) {
      if (re.test(h)) push(en)
    }
  }
  return out
}

export function buildScheduleImageKeywordPlan(rows: ScheduleImageKeywordDayInput[]): ScheduleImageKeywordPlan {
  const days = rows.filter((r) => r.day > 0).sort((a, b) => a.day - b.day)
  const cities = collectDestinationCitiesEn(days)
  const first = cities[0] ?? ''
  const last = cities[cities.length - 1] ?? first
  return {
    firstDestinationEn: first,
    lastDestinationEn: last,
    totalDays: days.length > 0 ? days[days.length - 1]!.day : 0,
  }
}

function isHubDepartureDay(ctx: ScheduleImageKeywordDayInput, plan: ScheduleImageKeywordPlan): boolean {
  const h = hay(ctx)
  if (!hasKoreanHub(h)) return false
  if (ctx.day === 1) return true
  return DEPARTURE_DAY_RE.test(h)
}

function isHubArrivalDay(ctx: ScheduleImageKeywordDayInput, plan: ScheduleImageKeywordPlan): boolean {
  const h = hay(ctx)
  if (!hasKoreanHub(h)) return false
  if (plan.totalDays > 0 && ctx.day === plan.totalDays) return true
  return ARRIVAL_DAY_RE.test(h)
}

function normKey(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

function splitDescriptionParts(description: string): string[] {
  return description
    .split(/[,，、·\n]|(?:\s+및\s+)|(?:\s+그리고\s+)/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 그날 본문·제목에 키워드가 실제로 등장하는지(다른 도시 명소 오염 방지) */
export function landmarkMentionedInDayContext(keyword: string, ctx: ScheduleImageKeywordDayInput): boolean {
  const fin = finalizeScheduleImageKeyword(keyword)
  if (!fin) return false
  const key = normKey(fin)
  const h = hay(ctx)
  if (h.toLowerCase().includes(key)) return true
  for (const { re, en } of KO_LANDMARK_RULES) {
    if (!re.test(h)) continue
    const mapped = finalizeScheduleImageKeyword(en)
    if (mapped && normKey(mapped) === key) return true
  }
  for (const part of splitDescriptionParts(ctx.description ?? '')) {
    const mapped = mapKoreanPoiSegment(part)
    if (!mapped) continue
    const m = finalizeScheduleImageKeyword(mapped)
    if (m && normKey(m) === key) return true
  }
  const mappedHay = mapKoreanPoiSegment(h)
  if (mappedHay) {
    const m = finalizeScheduleImageKeyword(mappedHay)
    if (m && normKey(m) === key) return true
  }
  return false
}

/** 관광 일차 — 도시명이 아닌 명소 영문 고유명 */
export function extractScheduleLandmarkFromDayContext(ctx: ScheduleImageKeywordDayInput): string {
  const h = hay(ctx)
  for (const { re, en } of KO_LANDMARK_RULES) {
    if (re.test(h)) {
      const fin = finalizeScheduleImageKeyword(en)
      if (fin) return fin
    }
  }

  const fromExtract = extractPlaceNameKeyword({
    title: ctx.title ?? '',
    description: ctx.description ?? '',
    rawBody: ctx.routeText ?? '',
  })
  if (fromExtract) return finalizeScheduleImageKeyword(fromExtract)

  const place = extractPrimaryEnglishPlaceName(
    ctx.routeText ?? '',
    ctx.description ?? '',
    ctx.title ?? '',
  )
  if (place) {
    const fin = finalizeScheduleImageKeyword(place)
    if (fin && !isBareCityOrCountryKeyword(fin)) return fin
  }

  const exclude = new Set<string>()
  for (const part of splitDescriptionParts(ctx.description ?? '')) {
    const mapped = mapKoreanPoiSegment(part)
    if (!mapped) continue
    const fin = finalizeScheduleImageKeyword(mapped)
    if (fin && !exclude.has(normalizeSemanticPoiKey(fin))) return fin
  }

  const fromKorean = firstPoiSearchTermExcluding(ctx.description ?? ctx.title ?? '', exclude)
  if (fromKorean) {
    const fin = finalizeScheduleImageKeyword(fromKorean)
    if (fin) return fin
  }

  for (const { re, en } of KO_CITY_TO_EN) {
    if (re.test(h)) {
      const iconic = CITY_ICONIC_LANDMARK[en.toLowerCase()]
      if (iconic) return finalizeScheduleImageKeyword(iconic)
    }
  }

  return ''
}

function coerceTourismLandmarkKeyword(
  raw: string,
  ctx: ScheduleImageKeywordDayInput,
): string {
  let kw = finalizeScheduleImageKeyword(String(raw ?? '').trim())
  const fromCtx = extractScheduleLandmarkFromDayContext(ctx)

  if (isBareCityOrCountryKeyword(kw)) {
    return fromCtx || CITY_ICONIC_LANDMARK[normKey(kw)] || ''
  }

  if (kw && !landmarkMentionedInDayContext(kw, ctx) && !isLikelyTourismLandmarkKeyword(kw)) {
    if (fromCtx) return fromCtx
  }

  if (!kw && fromCtx) return fromCtx

  return kw
}

/** 출발·귀국 허브 일차 — 첫/마지막 해외 도시 영문명(공항·IATA 금지). */
export function resolveScheduleHubImageKeyword(
  ctx: ScheduleImageKeywordDayInput,
  plan: ScheduleImageKeywordPlan,
): string | null {
  if (isHubDepartureDay(ctx, plan) && plan.firstDestinationEn) {
    return plan.firstDestinationEn
  }
  if (isHubArrivalDay(ctx, plan) && plan.lastDestinationEn) {
    return plan.lastDestinationEn
  }
  return null
}

/**
 * LLM imageKeyword 1차 정규화 + 허브 출발·귀국 규칙.
 * `supplierFinalize` — 공급사 전용 polish(모두투어 등)는 마지막에 선택 적용.
 */
export function polishRegisterScheduleImageKeywordFromLlm(
  raw: string,
  ctx: ScheduleImageKeywordDayInput,
  plan: ScheduleImageKeywordPlan,
  supplierFinalize?: (normalized: string, ctx: ScheduleImageKeywordDayInput) => string,
): string {
  const hubKw = resolveScheduleHubImageKeyword(ctx, plan)
  if (hubKw) {
    return finalizeScheduleImageKeyword(hubKw)
  }
  let kw = coerceTourismLandmarkKeyword(String(raw ?? '').trim(), ctx)
  if (supplierFinalize) {
    const polished = supplierFinalize(kw || finalizeScheduleImageKeyword(String(raw ?? '').trim()), ctx)
    kw = coerceTourismLandmarkKeyword(polished, ctx)
  }
  return kw
}

export function applyScheduleImageKeywordsToRows<
  T extends ScheduleImageKeywordDayInput & { imageKeyword: string; imageKeyword2?: string | null },
>(rows: T[], supplierFinalize?: (normalized: string, ctx: ScheduleImageKeywordDayInput) => string): T[] {
  return applyDualScheduleImageKeywordsToRows(rows, supplierFinalize)
}
