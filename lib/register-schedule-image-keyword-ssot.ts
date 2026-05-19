/**
 * 일정 schedule[].imageKeyword — 전 공급사 LLM·선추출 공통 SSOT.
 * - 일반 일차: 해당 일 가장 유명한 관광명소 1개(영문 고유명)
 * - 출발·귀국 일차에 국내 허브(인천·김포·부산·대구·청주 등): 첫·마지막 해외 도시 영문명
 */
import { finalizeScheduleImageKeyword } from '@/lib/pexels-place-name-keyword'
import { mapKoreanPoiSegment } from '@/lib/pexels-keyword'

/** REGISTER_PROMPT·schedule 선추출 프롬프트에 삽입 */
export const REGISTER_PROMPT_SCHEDULE_IMAGE_KEYWORD_BLOCK = `# [schedule[].imageKeyword — Pexels 검색용]
- **관광 일차:** 그날 일정(description·routeText·title)에서 **가장 유명한 관광명소·랜드마크 1개만** 영문 고유명으로 (예: Osaka Castle, Eiffel Tower, Halong Bay). 단순 도시명만(Paris, Da Nang 단독)·국가명·Day N travel·한글·공항·호텔·식사 키워드 금지.
- **출발·귀국 일차:** 본문에 인천·김포·부산·대구·청주·김해 등 **국내 출발/도착 허브**가 나오면 imageKeyword는 도시명이 아니라 **일정 전체의 첫 해외 도시 / 마지막 해외 도시 영문명**만 쓴다(예: 출발일→Tokyo, 귀국일→Osaka). 허브·공항 사진 키워드 금지.
- 불확실하면 빈 문자열.`

export const REGISTER_SCHEDULE_EXTRACT_IMAGE_KEYWORD_LINE =
  'imageKeyword(해당 일 **가장 유명한 관광명소** 영문 고유명 1개; 출발·귀국 허브 일차는 일정 첫·마지막 해외 **도시** 영문명),'

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
    const w = t.split(/\s+/).slice(0, 2).join(' ')
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
  let kw = finalizeScheduleImageKeyword(String(raw ?? '').trim())
  if (supplierFinalize && kw) {
    kw = supplierFinalize(kw, ctx)
    kw = finalizeScheduleImageKeyword(kw)
  }
  return kw
}

export function applyScheduleImageKeywordsToRows<T extends ScheduleImageKeywordDayInput & { imageKeyword: string }>(
  rows: T[],
  supplierFinalize?: (normalized: string, ctx: ScheduleImageKeywordDayInput) => string,
): T[] {
  const plan = buildScheduleImageKeywordPlan(rows)
  return rows.map((row) => ({
    ...row,
    imageKeyword: polishRegisterScheduleImageKeywordFromLlm(
      row.imageKeyword,
      {
        day: row.day,
        title: row.title,
        description: row.description,
        routeText: row.routeText,
      },
      plan,
      supplierFinalize,
    ),
  }))
}
