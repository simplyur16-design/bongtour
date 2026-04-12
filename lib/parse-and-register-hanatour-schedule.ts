/**
 * 하나투어 등록 파이프: 일정 표현층만 보정.
 * @see docs/register_schedule_expression_ssot.md
 */
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser-types'
import type { RegisterParsed, RegisterScheduleDay } from '@/lib/register-llm-schema-hanatour'
import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import { parseLlmJsonObject } from '@/lib/llm-json-extract'
import { stripCounselingTermsFromScheduleRow } from '@/lib/itinerary-counseling-terms-strip'
import {
  registerScheduleToDayInputs,
  type ItineraryDayInput,
} from '@/lib/upsert-itinerary-days-hanatour'

export const DAY_N_TRAVEL_RE = /^day\s*\d+\s*travel$/i

const HANGUL_RE = /[\uAC00-\uD7AF]/

/** Pexels용: 라틴 문자·공백·구두부호만, 2~10 단어 권역 */
function isLikelyEnglishPexelsKeyword(k: string): boolean {
  const t = k.trim()
  if (t.length < 10 || t.length > 120) return false
  if (HANGUL_RE.test(t)) return false
  if (isHanatourDateLikeScheduleToken(t)) return false
  if (DAY_N_TRAVEL_RE.test(t)) return false
  if (isHanatourMealOrHotelLine(t)) return false
  if (/\d{1,2}\/\d{1,2}/.test(t) || /\d{1,2}-\d{1,2}\b/.test(t)) return false
  if (/\b(hotel|resort|buffet|breakfast|lunch|dinner|brunch)\b/i.test(t)) return false
  const words = t.split(/\s+/).filter(Boolean).length
  if (words < 2 || words > 10) return false
  return /^[A-Za-z0-9\s,.'-]+$/.test(t)
}

export function isHanatourEnglishPexelsImageKeywordReady(kw: string): boolean {
  return isLikelyEnglishPexelsKeyword(kw.trim())
}

/**
 * 하나투어 일차 블록(한글 본문 포함) → Pexels 검색용 영문 noun phrase.
 * 최소 장소 매핑만 사용; 불명확 시 도시+배경 fallback.
 */
export function hanatourEnglishPexelsImageKeywordFromBlob(blob: string, day: number, maxDay: number): string {
  const j = blob.replace(/\r/g, '').slice(0, 24_000)

  const spots: [RegExp, string][] = [
    [/스타벅스\s*리저브|Starbucks\s+Reserve\s+Roastery/i, 'Shanghai Starbucks Reserve Roastery interior'],
    [/우캉(루|로)|Wukang\s+Road/i, 'Wukang Road historic street Shanghai'],
    [/외탄|와이탄|The\s+Bund|\bBund\b/i, 'Shanghai Bund night skyline'],
    [/남경로|Nanjing\s+Road/i, 'Nanjing Road Shanghai neon shopping street'],
    [/임시정부|Provisional\s+Government|Former\s+Provisional/i, 'Shanghai Korea Provisional Government museum'],
    [/신천지|Xintiandi/i, 'Xintiandi Shanghai shikumen lanes'],
    [/장위엔/i, 'Zhangyuan Shanghai historic garden quarter'],
    [/동방명주|Oriental\s+Pearl/i, 'Shanghai Oriental Pearl tower skyline'],
    [/황포강|Huangpu\s+River/i, 'Huangpu River Shanghai skyline cruise boat'],
    [/예원|Yu\s*Garden|豫园/i, 'Yu Garden Shanghai classical pavilion pond'],
    [/상해\s*옛\s*거리|Shanghai\s+Old\s+Street/i, 'Shanghai Old Street traditional architecture'],
    [/방생교/, 'Zhujiajiao stone bridge canal water town'],
    [/주가각|朱家角|Zhujiajiao/i, 'Zhujiajiao water town canal bridge Shanghai'],
    [/백두산|장백산|Changbai\s+Mountain/i, 'Changbai Mountain scenic volcanic peaks'],
    [/장백폭포|Changbai\s+waterfall/i, 'Changbai Mountain waterfall forest gorge'],
    [/금강대|Heaven\s*Lake/i, 'Heaven Lake Changbai volcanic crater scenic'],
  ]
  for (const [re, kw] of spots) {
    if (re.test(j)) return kw
  }

  if (day === 1 && /ICN|인천|Incheon/i.test(j) && /PVG|Pudong|푸동|상해|Shanghai/i.test(j) && /도착|arrival/i.test(j)) {
    return 'Shanghai Pudong airport arrival'
  }
  if (
    day === maxDay &&
    maxDay >= 2 &&
    /PVG|Pudong|푸동|상해|Shanghai/i.test(j) &&
    /출발|departure/i.test(j) &&
    /ICN|인천|Incheon/i.test(j)
  ) {
    return 'Shanghai airport departure international terminal'
  }

  if (/상해|上海|Shanghai/i.test(j)) return 'Shanghai skyline night Huangpu river'
  if (/연길|延吉|Yanji/i.test(j)) return 'Yanji Korean quarter street night market'
  if (/방콕|Bangkok/i.test(j)) return 'Bangkok temple river golden hour skyline'
  if (/도쿄|Tokyo/i.test(j)) return 'Tokyo Shibuya crossing night city lights'
  if (/파리|Paris/i.test(j)) return 'Paris Eiffel Tower skyline twilight'
  if (/인천|Incheon/i.test(j) && day === 1) return 'Incheon International Airport departure gate'

  return 'Scenic Asian city travel skyline dusk'
}

/** 카드 description: 1문장, 허용 90~150자·목표 100~140자 */
const HANATOUR_CARD_DESCRIPTION_MAX = 150
/** 교체·보강 판정 하한(이 미만이면 규칙 보강·제미나이 후보) */
const HANATOUR_CARD_DESCRIPTION_MIN = 90
/** 설명 밀도 목표 하한(가능하면 이 길이까지 장소·동선으로 채움) */
const HANATOUR_CARD_DESCRIPTION_TARGET = 100

/** 본문에 실제로 있을 때만 제목·설명 재료로 쓰는 관광·동선 토막(긴 문자열 우선 매칭) */
const HANATOUR_KNOWN_POI_SUBSTRINGS: readonly string[] = [
  '스타벅스 리저브 로스터리',
  '스타벅스 리저브',
  '푸동국제공항',
  '임시정부청사',
  '금강대협곡',
  '장백폭포',
  '하나투어 미팅',
  '우캉로',
  '우캉루',
  '남경로',
  '신천지',
  '동방명주',
  '장위엔',
  '방생교',
  '북대가',
  '주가각',
  '외탄',
  '와이탄',
  '예원',
  '황포강',
  '백두산',
  '장백산',
  '이도백하',
  '연길',
  '상해',
  '인천',
  '푸동',
  '김포',
  '서울',
  '방콕',
  '도쿄',
  '파리',
  '금강대',
  '서파',
  '북파',
  'PVG',
  'ICN',
  'GMP',
  'YNJ',
]

const HANATOUR_TITLE_FORBIDDEN = new Set(
  ['상세내용을 확인해보세요', '상세보기', '일정 전체펼침', '큐알', '출입국 정보'].map((s) => s.toLowerCase())
)

const HANATOUR_LINE_NOISE_RES: RegExp[] = [
  /^\d+\/\d+이전다음$/i,
  /1\/2\s*이전다음/i,
  /이전다음$/,
  /일정표_\d?|_\d*일정표_/i,
  /^상세보기\s*$/i,
  /^상세내용을 확인해보세요\s*$/i,
  /^큐알\s*$/,
  /^출입국\s*정보\s*$/,
  /^예약\s*전\s*유의사항\s*$/,
  /^식사\s*$/,
  /^호텔\s*$/,
  /^이전\s*$/,
  /^다음\s*$/,
  /^요금\s*[:：]/,
  /^소요시간\s*[:：]/,
  /^대체일정\s*[:：]/,
  /^미선택시/i,
  /^\[TIP\]/i,
  /^※/,
  /^▶/,
  /^■/,
]

export function isHanatourDateLikeScheduleToken(s: string): boolean {
  const t = s.trim()
  if (!t) return true
  if (/^\d{1,2}\/\d{1,2}\s*\([월화수목금토일]\)\s*$/.test(t)) return true
  if (/^\d{1,2}\/\d{1,2}\s*$/.test(t)) return true
  if (/^\d{1,2}-\d{1,2}\s*$/.test(t)) return true
  if (/^\d{4}\.\d{1,2}\.\d{1,2}/.test(t)) return true
  return false
}

/** 일정 요약(description)·관광지 키워드에서 제외: 식사·숙박 박스 전용 줄 */
function isHanatourMealOrHotelLine(s: string): boolean {
  const t = s.trim()
  if (/^조식|^중식|^석식|^식사\s*[：:]|^아침\s|^점심\s|^저녁\s/i.test(t)) return true
  if (/호텔\s*식|호텔식|현지식|딤섬|삼겹살|우육면|사천요리/i.test(t) && t.length < 80) return true
  if (/홀리데이|Holiday\s+Inn|호텔\s*투숙|예정\s*호텔|숙박\s*없음|기내숙박|리조트|콘도/i.test(t)) return true
  return false
}

function stripLeadingHanatourDatePrefix(s: string): string {
  return s
    .replace(/^\d{1,2}\/\d{1,2}\s*\([월화수목금토일]\)\s*/, '')
    .replace(/^\d{1,2}-\d{1,2}\s+/, '')
    .replace(/^\d{1,2}\/\d{1,2}\s+/, '')
    .trim()
}

/** 장문 일정표·리스트·다문장이 카드 description으로 들어온 경우 */
function hanatourDescriptionLooksLikeDetailDump(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  if (t.length > HANATOUR_CARD_DESCRIPTION_MAX) return true
  const lines = t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
  if (lines.length >= 3) return true
  if (lines.length === 2 && lines.some((l) => l.length > 70)) return true
  const chunks = t.split(/(?<=[.!?。])\s+/).map((x) => x.trim()).filter((x) => x.length > 8)
  if (chunks.length >= 3) return true
  if (/※\s*※|[▶■]{2,}/.test(t)) return true
  if (/\d{1,2}\/\d{1,2}\s*\([월화수목금토일]\)/.test(t)) return true
  if (/유의사항|개요\s*[:：]|선택관광\s*안내|TIP\]/i.test(t)) return true
  return false
}

function stripHanatourScheduleNoiseLines(raw: string): string[] {
  const lines = raw.replace(/\r/g, '').split('\n')
  const out: string[] = []
  let prev = ''
  for (let line of lines) {
    line = line.trim()
    if (!line) continue
    if (/\(\d+\)\s*\d*일정표_/i.test(line) || /\d+일정표_/i.test(line)) {
      const head = line.split(/[\(（]/)[0]?.trim() ?? ''
      if (head.length >= 4 && head.length <= 80) line = head.replace(/\s+/g, ' ').trim()
      else continue
    }
    const low = line.toLowerCase()
    if (HANATOUR_TITLE_FORBIDDEN.has(low)) continue
    if (HANATOUR_LINE_NOISE_RES.some((re) => re.test(line))) continue
    if (isHanatourMealOrHotelLine(line)) continue
    if (line.length > 200) continue
    const compact = line.replace(/\s+/g, '')
    if (compact.length >= 24 && /^(.{6,40})\1{2,}/.test(compact)) continue
    if (line === prev && line.length < 120) continue
    out.push(line)
    prev = line
  }
  return out
}

function extractHanatourMealsFromScheduleBlock(t: string): Partial<
  Pick<RegisterScheduleDay, 'breakfastText' | 'lunchText' | 'dinnerText' | 'mealSummaryText'>
> {
  const out: Partial<
    Pick<RegisterScheduleDay, 'breakfastText' | 'lunchText' | 'dinnerText' | 'mealSummaryText'>
  > = {}
  const bracket3 = t.match(/\[조식\]\s*([^[\]]+?)\s*\[중식\]\s*([^[\]]+?)\s*\[석식\]\s*([^[\]\n]+)/i)
  if (bracket3) {
    const a = bracket3[1]?.replace(/상세보기.*/i, '').trim()
    const b = bracket3[2]?.replace(/상세보기.*/i, '').trim()
    const c = bracket3[3]?.replace(/상세보기.*/i, '').trim()
    if (a) out.breakfastText = a.slice(0, 200)
    if (b) out.lunchText = b.slice(0, 200)
    if (c) out.dinnerText = c.slice(0, 200)
    out.mealSummaryText = [a, b, c].filter(Boolean).join(' · ').slice(0, 500)
    return out
  }
  const bp2 = t.match(/조식\s*[（(]\s*([^)）\n]+)[)）]/i)
  const lp2 = t.match(/중식\s*[（(]\s*([^)）\n]+)[)）]/i)
  const dp2 = t.match(/석식\s*[（(]\s*([^)）\n]+)[)）]/i)
  if (bp2?.[1]) out.breakfastText = bp2[1].trim().slice(0, 200)
  if (lp2?.[1]) out.lunchText = lp2[1].trim().slice(0, 200)
  if (dp2?.[1]) out.dinnerText = dp2[1].trim().slice(0, 200)
  if (out.breakfastText || out.lunchText || out.dinnerText) {
    out.mealSummaryText = [out.breakfastText, out.lunchText, out.dinnerText].filter(Boolean).join(' · ').slice(0, 500)
    return out
  }
  const bp = t.match(/(?:조식|아침)\s*[-:：]\s*([^\n]+)/i)
  const lp = t.match(/(?:중식|점심)\s*[-:：]\s*([^\n]+)/i)
  const dp = t.match(/(?:석식|저녁)\s*[-:：]\s*([^\n]+)/i)
  if (bp?.[1]) out.breakfastText = bp[1].trim().slice(0, 200)
  if (lp?.[1]) out.lunchText = lp[1].trim().slice(0, 200)
  if (dp?.[1]) out.dinnerText = dp[1].trim().slice(0, 200)
  if (out.breakfastText || out.lunchText || out.dinnerText) {
    out.mealSummaryText = [out.breakfastText, out.lunchText, out.dinnerText].filter(Boolean).join(' · ').slice(0, 500)
  }
  return out
}

function extractHanatourHotelFromScheduleBlock(t: string): Partial<Pick<RegisterScheduleDay, 'hotelText'>> {
  if (/숙박\s*없음/.test(t)) return { hotelText: '숙박 없음' }
  if (/기내\s*숙박|기내숙박/.test(t)) return { hotelText: '기내숙박' }
  const hp = t.match(/(?:예정\s*호텔|예정숙소|숙소|숙박|투숙|호텔)\s*[:：]\s*([^\n]+)/i)
  if (hp?.[1]) return { hotelText: hp[1].trim().replace(/상세보기.*/i, '').slice(0, 500) }
  const hol = t.match(/(?:홀리데이\s*인[^\n]{5,120}|Holiday\s+Inn[^\n]{5,140})/i)
  if (hol?.[0]) return { hotelText: hol[0].replace(/상세보기.*/i, '').trim().slice(0, 200) }
  return {}
}

function inferHanatourMovementTitle(joined: string, day: number, maxDay: number): string | null {
  const head = joined.slice(0, 14_000)
  const dest =
    /연길|YNJ/i.test(head) ? '연길' : /상해|PVG|푸동/i.test(head) ? '상해' : /방콕|BKK/i.test(head) ? '방콕' : null
  if (
    day === 1 &&
    /(PVG|푸동국제공항|상해\s*푸동|상해.*공항)/i.test(head) &&
    /(입국|도착)/.test(head) &&
    /(미팅|피켓|하나투어|가이드)/i.test(head)
  ) {
    return dest ? `${dest} 입국 및 미팅` : `현지 입국 및 미팅`
  }
  if (day === 1 && /ICN\s*출발|인천(?:공항)?.*출발/i.test(head) && /도착|PVG|YNJ|CJU|GMP|김포/i.test(head)) {
    if (dest) return `인천 출발 및 ${dest} 도착`
  }
  if (
    day === maxDay &&
    maxDay >= 1 &&
    /ICN\s*도착|인천(?:공항)?.*도착|서울\s*ICN\s*도착/i.test(head) &&
    /출발/.test(head)
  ) {
    const from = /연길.*출발|YNJ.*출발/i.test(head)
      ? '연길'
      : /상해.*출발|PVG.*출발/i.test(head)
        ? '상해'
        : /주가각/.test(head)
          ? '주가각'
          : dest ?? '현지'
    return `${from} 출발 및 인천 귀국`
  }
  return null
}

function findHanatourItineraryHeadline(lines: string[]): string | null {
  for (const line of lines) {
    if (line.length < 10 || line.length > 130) continue
    if (/일정표_|이전다음|\(\d+\)\s*\d*일정표_/i.test(line)) continue
    if (isHanatourDateLikeScheduleToken(line)) continue
    if (isHanatourMealOrHotelLine(line)) continue
    if (/^조식|^중식|^석식|^식사\s*[：:]/.test(line)) continue
    if (HANATOUR_TITLE_FORBIDDEN.has(line.toLowerCase())) continue
    if (/이동\s*\(/.test(line) && line.length < 80) continue
    if (
      /[，,]/.test(line) ||
      /관광|유람|데이투어|명소|거리|마을|출발|도착|공항|코스|탐방|폭포|협곡/.test(line)
    )
      return line
  }
  return null
}

function extractOrderedKnownPoiFromJoined(joined: string): string[] {
  const j = joined.slice(0, 14_000)
  const known = [...HANATOUR_KNOWN_POI_SUBSTRINGS].sort((a, b) => b.length - a.length)
  type Hit = { start: number; end: number; s: string }
  const hits: Hit[] = []
  for (const s of known) {
    if (!s || !j.includes(s)) continue
    let from = 0
    let idx: number
    while ((idx = j.indexOf(s, from)) !== -1) {
      hits.push({ start: idx, end: idx + s.length, s })
      from = idx + Math.max(1, s.length)
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
  const picked: Hit[] = []
  let lastEnd = -1
  for (const h of hits) {
    if (h.start < lastEnd) continue
    picked.push(h)
    lastEnd = h.end
  }
  return picked.map((h) => h.s).slice(0, 8)
}

function normaliseHanatourTitleSegment(s: string): string {
  return stripLeadingHanatourDatePrefix(s)
    .replace(/\s+/g, ' ')
    .replace(/[,.，、·]$/, '')
    .trim()
}

function mergeHanatourTitlePlaceParts(parts: string[], maxParts: number): string | null {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of parts) {
    const n = normaliseHanatourTitleSegment(raw)
    if (n.length < 2 || n.length > 22) continue
    if (isHanatourMealOrHotelLine(n)) continue
    if (/요금|소요시간|대체일정|TIP|호텔|조식|중식|석식|선택관광|유의사항/i.test(n)) continue
    if (isHanatourDateLikeScheduleToken(n)) continue
    if (seen.has(n)) continue
    const contained = [...seen].some((o) => o.includes(n) || n.includes(o))
    if (contained && n.length < 4) continue
    seen.add(n)
    out.push(n)
    if (out.length >= maxParts) break
  }
  if (out.length >= 2) return out.join(' - ').slice(0, 80)
  if (out.length === 1) return out[0]!
  return null
}

function buildHanatourMovementRouteTitle(joined: string, day: number, maxDay: number): string | null {
  const j = joined.slice(0, 12_000)
  const movementSignal =
    inferHanatourMovementTitle(joined, day, maxDay) != null ||
    (day === maxDay &&
      maxDay >= 2 &&
      /(귀국|인천\s*도착|ICN\s*도착|서울\s*도착)/.test(j) &&
      /출발/.test(j)) ||
    (day === 1 &&
      /출발/.test(j) &&
      /(도착|입국)/.test(j) &&
      /(공항|ICN|PVG|GMP|김포|인천)/.test(j)) ||
    (day === 1 && hanatourMovementSignalsStrong(j, 1) && !hanatourJoinedHasTourismEvidence(j))
  if (!movementSignal) return null
  const inc = /인천|ICN|김포|GMP/.test(joined) ? '인천' : null
  const sh = /상해|푸동|PVG/.test(joined) ? '상해' : null
  const yj = /연길|YNJ/.test(joined) ? '연길' : null
  if (day === 1) {
    if (inc && sh) return `${inc} - ${sh}`.slice(0, 80)
    if (yj && sh && !inc) return `${yj} - ${sh}`.slice(0, 80)
    if (inc && yj && !sh) return `${inc} - ${yj}`.slice(0, 80)
  }
  const p = extractHanatourOrderedPlaceHints(joined)
  if (p.length >= 2) return `${p[0]} - ${p[p.length - 1]}`.slice(0, 80)
  if (day === maxDay && maxDay >= 2) {
    if (sh && inc) return `${sh} - ${inc}`
    if (yj && inc) return `${yj} - ${inc}`
    if (p.length === 1) return `${p[0]!} - 인천`.slice(0, 80)
  }
  if (inc || sh || yj) {
    const u = [inc, yj, sh].filter(Boolean) as string[]
    const uniq = [...new Set(u)]
    if (uniq.length >= 2) return `${uniq[0]!} - ${uniq[uniq.length - 1]!}`.slice(0, 80)
    if (uniq.length === 1) return uniq[0]!
  }
  return null
}

/** 카드 title: 장소·동선을 ` - ` 로 연결(2~6개), 문장형·날짜·placeholder 금지 */
function buildHanatourCardPlaceTitle(day: number, maxDay: number, lines: string[], joined: string): string {
  const j0 = joined.slice(0, 12_000)
  if (day === 1 && hanatourMovementSignalsStrong(j0, 1) && !hanatourJoinedHasTourismEvidence(j0)) {
    const inc = /인천|ICN|김포|GMP/.test(j0)
    const sh = /상해|푸동|PVG/.test(j0)
    if (inc && sh) return '인천 - 상해'
  }
  const route = buildHanatourMovementRouteTitle(joined, day, maxDay)
  if (route) return route
  const pois = extractOrderedKnownPoiFromJoined(joined)
  const head = findHanatourItineraryHeadline(lines)
  const seg = headlineTourismSegments(head)
  const merged = mergeHanatourTitlePlaceParts([...pois, ...seg], 6)
  if (merged) return merged
  const geo =
    joined.match(/(연길|상해|주가각|백두산|방콕|도쿄|파리|인천|이도백하|금강대|장백)/)?.[1] ?? null
  if (geo) {
    const extra = pois[0] || seg[0]
    if (extra && extra !== geo) return `${geo} - ${extra}`.slice(0, 80)
    return geo
  }
  const plain = lines.find(
    (l) =>
      l.length >= 6 &&
      l.length <= 48 &&
      !isHanatourMealOrHotelLine(l) &&
      !isHanatourDateLikeScheduleToken(l) &&
      !HANATOUR_TITLE_FORBIDDEN.has(l.toLowerCase()) &&
      !/요금|소요시간|대체일정|TIP|^※|^▶|^■/i.test(l)
  )
  if (plain) return normaliseHanatourTitleSegment(plain).slice(0, 24)
  const jl = joined
    .split('\n')
    .map((l) => l.trim())
    .find(
      (l) =>
        l.length >= 8 &&
        l.length <= 44 &&
        !isHanatourDateLikeScheduleToken(l) &&
        !isHanatourMealOrHotelLine(l) &&
        !/요금|소요시간|대체일정|TIP|^※|^▶|^■/i.test(l)
    )
  if (jl) return normaliseHanatourTitleSegment(jl).slice(0, 22)
  return '일차 동선'
}

function longestCommonSubstringLen(a: string, b: string): number {
  let best = 0
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1
        if (dp[i]![j]! > best) best = dp[i]![j]!
      }
    }
  }
  return best
}

/** title 과 description 이 사실상 동일·과도하게 겹치면 description 을 다시 쓴다 */
function hanatourDescriptionOverlapsTitle(title: string, desc: string): boolean {
  const t = title.replace(/\s+/g, '').trim()
  const d = desc.replace(/\s+/g, '').replace(/\./g, '').trim()
  if (!t || !d) return false
  if (t === d) return true
  if (
    title.includes(' - ') &&
    /(둘러본뒤|마무리합니다|호텔로이동|도착후|관광합니다|미팅을진행)/.test(d)
  ) {
    const m = Math.min(t.length, d.length)
    return m > 14 && longestCommonSubstringLen(t, d) / m >= 0.82
  }
  const shorter = t.length <= d.length ? t : d
  const longer = t.length > d.length ? t : d
  if (shorter.length >= 8 && longer.includes(shorter) && shorter.length / longer.length >= 0.55) return true
  const m = Math.min(t.length, d.length)
  return m > 8 && longestCommonSubstringLen(t, d) / m >= 0.68
}

/** 본문에 관광·방문·탐방 근거가 있는지(이동일 전용 판별에 사용). */
function hanatourJoinedHasTourismEvidence(joined: string): boolean {
  const j = joined.slice(0, 14_000)
  return /(관광|방문|탐방|둘러보|명소|유람|데이투어|체험|포토|쇼핑\s*센터|사진\s*타임)/.test(j)
}

/** 공항·출발·도착·입국·미팅·숙소방향·귀국 등 이동 신호(2개 이상 또는 1일차 입국+공항). */
function hanatourMovementSignalsStrong(joined: string, day: number): boolean {
  const j = joined.slice(0, 12_000)
  const hits = [
    /공항|ICN|PVG|GMP|김포|국제선|국내선/.test(j),
    /출발/.test(j),
    /도착|입국/.test(j),
    /미팅|피켓|하나투어|가이드/.test(j),
    /호텔로|호텔\s*로|숙소|투숙|체류\s*지/.test(j),
    /귀국|인천\s*도착|ICN\s*도착/.test(j),
  ].filter(Boolean).length
  if (day === 1) {
    if (hits >= 2) return true
    if (/(입국|도착)/.test(j) && /(공항|ICN|PVG|GMP|푸동)/.test(j)) return true
    if (/(미팅|피켓|하나투어)/.test(j) && /(공항|입국|도착|PVG|푸동)/.test(j)) return true
  }
  return hits >= 2
}

function isHanatourMovementPatternDay(joined: string, day: number, maxDay: number): boolean {
  const j = joined.slice(0, 12_000)
  if (day === maxDay && maxDay >= 2 && /(귀국|인천\s*도착|ICN\s*도착|서울\s*도착)/.test(j) && /출발/.test(j)) return true
  if (
    day === maxDay &&
    maxDay >= 2 &&
    /(인천|ICN|김포|GMP)/.test(j) &&
    /(출발|귀국|탑승)/.test(j) &&
    /(상해|PVG|푸동|연길|YNJ)/.test(j)
  )
    return true
  if (day === 1 && /출발/.test(j) && /(도착|입국)/.test(j) && /(공항|ICN|PVG|GMP|김포|인천)/.test(j)) return true
  if (
    day === 1 &&
    /(입국|도착|공항|피켓|미팅)/.test(j) &&
    /(상해|PVG|푸동|연길|YNJ|김포)/.test(j) &&
    /(하나투어|가이드|호텔|공항)/.test(j)
  )
    return true
  if (day === 1 && hanatourMovementSignalsStrong(j, 1) && !hanatourJoinedHasTourismEvidence(j)) return true
  return false
}

function extractHanatourOrderedPlaceHints(j: string): string[] {
  const j0 = j.slice(0, 8000)
  const found: { idx: number; name: string }[] = []
  const push = (idx: number, name: string | undefined) => {
    const n = (name ?? '').trim()
    if (n.length < 2 || n.length > 14) return
    if (/^(출발|도착|입국|귀국|공항|미팅|이동|관광|당일|현지|일정|국제)$/.test(n)) return
    found.push({ idx, name: n })
  }
  const res: RegExp[] = [
    /([\uAC00-\uD7AF]{2,10})\s*에서\s*출발/g,
    /([\uAC00-\uD7AF]{2,10})(?:을|를)\s*경유/g,
    /([\uAC00-\uD7AF]{2,10})(?:공항|국제공항)?\s*에\s*도착/g,
    /([\uAC00-\uD7AF]{2,10})로\s*귀국/g,
    /([\uAC00-\uD7AF]{2,10})\s*출발/g,
  ]
  for (const re of res) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(j0)) !== null) push(m.index, m[1])
  }
  found.sort((a, b) => a.idx - b.idx)
  const out: string[] = []
  const seen = new Set<string>()
  for (const { name } of found) {
    if (!seen.has(name)) {
      seen.add(name)
      out.push(name)
    }
  }
  return out.slice(0, 5)
}

function headlineTourismSegments(headLine: string | null): string[] {
  if (!headLine) return []
  const t = stripLeadingHanatourDatePrefix(headLine)
  return t
    .split(/[,，、·]/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length >= 2 &&
        s.length <= 28 &&
        !isHanatourMealOrHotelLine(s) &&
        !isHanatourDateLikeScheduleToken(s) &&
        !/요금|소요시간|대체일정|TIP|호텔|조식|중식|석식/i.test(s)
    )
    .slice(0, 3)
}

function pickBestHanatourMotionSummaryLine(lines: string[]): string | null {
  let best: string | null = null
  let bestScore = 0
  for (const raw of lines) {
    const line = stripLeadingHanatourDatePrefix(raw).replace(/\s+/g, ' ').trim()
    if (line.length < 12 || line.length > 160) continue
    if (isHanatourMealOrHotelLine(line)) continue
    if (/요금|소요시간|대체일정|TIP|상세내용|이전다음|일정표_|^이동\s*\(/i.test(line)) continue
    if (!/(출발|도착|입국|귀국|경유|미팅|공항|터미널|항공)/.test(line)) continue
    const score =
      (line.match(/출발|도착|입국|귀국|경유|미팅/g) ?? []).length * 12 + Math.min(line.length, 110)
    if (score > bestScore) {
      bestScore = score
      best = line
    }
  }
  return best
}

function pickBestHanatourTourismSummaryLine(lines: string[]): string | null {
  let best: string | null = null
  let bestScore = 0
  for (const raw of lines) {
    const line = stripLeadingHanatourDatePrefix(raw).replace(/\s+/g, ' ').trim()
    if (line.length < 12 || line.length > 160) continue
    if (isHanatourMealOrHotelLine(line)) continue
    if (/요금|소요시간|대체일정|TIP|상세내용|이전다음|일정표_|유의사항/i.test(line)) continue
    if (!/(관광|탐방|명소|유람|코스|방문|데이투어)/.test(line)) continue
    if (/^이동\s*\(/.test(line) && line.length < 70) continue
    const score = (line.match(/관광|탐방|명소|유람|코스|방문/g) ?? []).length * 10 + Math.min(line.length, 100)
    if (score > bestScore) {
      bestScore = score
      best = line
    }
  }
  return best
}

function primaryGeoToken(joined: string, title: string): string | null {
  const blob = `${joined}\n${title}`
  const m = blob.match(
    /(연길|상해|주가각|백두산|방콕|도쿄|파리|인천|이도백하|장백|금강대|서파|북파|푸동|YNJ|PVG)/i
  )
  if (m?.[1]) return m[1]!
  const h = title.match(/([\uAC00-\uD7AF]{2,8})/)
  const g = h?.[1]
  if (g && !/^(일차|일정|현지)$/.test(g)) return g
  return null
}

function hanatourTrimOneSentenceMax(s: string, max: number = HANATOUR_CARD_DESCRIPTION_MAX): string {
  let t = s.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
  if (!t) return '일정표에 따라 이동·관광을 진행합니다.'
  const dotIdx = t.indexOf('.', 24)
  if (dotIdx !== -1 && dotIdx < t.length - 1) {
    const rest = t.slice(dotIdx + 1).trim()
    if (rest.length > 8) t = t.slice(0, dotIdx + 1).trim()
  }
  if (t.length > max) {
    const cut = t.slice(0, max)
    const sp = cut.lastIndexOf(' ')
    t = (sp > 40 ? cut.slice(0, sp) : cut).trim()
  }
  if (!/[.!?…]$/.test(t)) t = `${t}.`
  return t.slice(0, HANATOUR_CARD_DESCRIPTION_MAX).trim()
}

function hanatourEnsureDescriptionMinLength(
  sentence: string,
  lines: string[],
  motionLinesOnly: boolean = false
): string {
  let t = sentence.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
  const bare = () => t.replace(/\.$/, '').length
  if (bare() >= HANATOUR_CARD_DESCRIPTION_TARGET) return t
  let guard = 0
  while (bare() < HANATOUR_CARD_DESCRIPTION_TARGET && guard < 4) {
    guard += 1
    const ml =
      pickBestHanatourMotionSummaryLine(lines) ??
      (!motionLinesOnly ? pickBestHanatourTourismSummaryLine(lines) : null)
    if (!ml || /(호텔\s*[:：]|조식|중식|석식)/i.test(ml)) break
    const frag = stripLeadingHanatourDatePrefix(ml).replace(/\s+/g, ' ').trim()
    if (frag.length < 14) break
    const need = HANATOUR_CARD_DESCRIPTION_TARGET - bare()
    const clip = frag.slice(0, Math.min(frag.length, need + 72))
    const sp = clip.lastIndexOf(' ')
    const prefix = (sp > 22 ? clip.slice(0, sp) : clip).trim()
    if (prefix.length < 12) break
    const merged = `${prefix} ${t}`.replace(/\s+/g, ' ').trim()
    if (merged.length <= bare() + 2) break
    t = merged
  }
  return t
}

function hanatourMovementDescriptionFallback(joined: string, day: number, maxDay: number): string {
  const p = extractHanatourOrderedPlaceHints(joined)
  if (p.length >= 3) {
    return hanatourTrimOneSentenceMax(
      `${p[0]} 구간에서 출발해 ${p[1]}를 경유한 뒤 ${p[2]} 방향으로 이동하며 당일 공항·이동 절차와 접속 동선을 이어갑니다.`,
      HANATOUR_CARD_DESCRIPTION_MAX
    )
  }
  if (p.length >= 2) {
    return hanatourTrimOneSentenceMax(
      `${p[0]}에서 출발해 ${p[1]}로 이어지는 이동 동선을 따라 이동하며 당일 교통·이동 일정을 진행합니다.`,
      HANATOUR_CARD_DESCRIPTION_MAX
    )
  }
  if (p.length === 1) {
    if (day === maxDay && maxDay >= 2)
      return hanatourTrimOneSentenceMax(
        `${p[0]}에서 출발해 인천 방향으로 귀국 동선에 올라 탑승과 출국 절차를 마치며 당일 여정을 마무리합니다.`,
        HANATOUR_CARD_DESCRIPTION_MAX
      )
    return hanatourTrimOneSentenceMax(
      `${p[0]}에 도착한 뒤 공항·현지 접속 절차를 밟고 당일 이동 일정을 시작합니다.`,
      HANATOUR_CARD_DESCRIPTION_MAX
    )
  }
  return hanatourTrimOneSentenceMax(
    '일정표에 따른 공항·구간 이동 순서를 따라 당일 이동과 접속 절차를 진행합니다.',
    HANATOUR_CARD_DESCRIPTION_MAX
  )
}

function hanatourTourismDescriptionFallback(
  joined: string,
  title: string,
  day: number,
  maxDay: number
): string {
  if (isHanatourMovementPatternDay(joined, day, maxDay)) {
    return hanatourMovementDescriptionFallback(joined, day, maxDay)
  }
  const pois = extractOrderedKnownPoiFromJoined(joined)
  if (pois.length >= 2) {
    return hanatourTrimOneSentenceMax(
      `${pois.slice(0, Math.min(5, pois.length)).join(', ')} 일대를 순서대로 둘러본 뒤 이동과 관람을 이어가며 당일 관광 일정을 마무리합니다.`,
      HANATOUR_CARD_DESCRIPTION_MAX
    )
  }
  const geo = primaryGeoToken(joined, title)
  if (geo) return `${geo} 핵심 일정을 중심으로 관광합니다.`
  return `일정표에 따라 관광·이동을 진행합니다.`
}

function buildHanatourMovementDayDescription(
  lines: string[],
  joined: string,
  day: number,
  maxDay: number
): string {
  const j0 = joined.slice(0, 8000)
  if (day === maxDay && maxDay >= 2) {
    if (/(인천|ICN|김포|GMP)/.test(j0) && /(출발|귀국|탑승)/.test(j0) && /(상해|PVG|푸동|연길|YNJ)/.test(j0)) {
      const core = buildDenseReturnHomeDescription(joined, maxDay)
      return hanatourTrimOneSentenceMax(
        hanatourEnsureDescriptionMinLength(core, lines, true),
        HANATOUR_CARD_DESCRIPTION_MAX
      )
    }
  }
  const p = extractHanatourOrderedPlaceHints(joined)
  const arrival =
    p.length > 0 ? p[p.length - 1]! : joined.match(/(상해|연길|푸동|인천|김포|서울)/)?.[1] ?? ''
  const ml = pickBestHanatourMotionSummaryLine(lines)
  if (
    ml &&
    /(입국|미팅|공항|피켓|터미널|PVG|ICN|GMP|도착)/.test(ml) &&
    !/(조식|중식|석식|호텔\s*[:：])/i.test(ml)
  ) {
    const frag = stripLeadingHanatourDatePrefix(ml).replace(/\s+/g, ' ').trim().slice(0, 88)
    const tail = arrival
      ? `${arrival} 도착 기준으로 가이드 미팅을 진행하고 호텔로 이동합니다.`
      : `가이드 미팅을 진행하고 호텔로 이동합니다.`
    const core = `${frag} 뒤 ${tail}`.replace(/\s+/g, ' ')
    let out = hanatourTrimOneSentenceMax(hanatourEnsureDescriptionMinLength(core, lines, true), HANATOUR_CARD_DESCRIPTION_MAX)
    if (movementDescriptionHasForbiddenTourismWording(out))
      out = rebuildMovementDayDescriptionWithoutTourismWording(lines, joined, day, maxDay)
    return out
  }
  const tail2 = arrival
    ? `${arrival} 도착 후 가이드 미팅을 진행하고 호텔로 이동합니다.`
    : `가이드 미팅을 진행한 뒤 당일 동선으로 이동합니다.`
  let out2 = hanatourTrimOneSentenceMax(hanatourEnsureDescriptionMinLength(tail2, lines, true), HANATOUR_CARD_DESCRIPTION_MAX)
  if (movementDescriptionHasForbiddenTourismWording(out2))
    out2 = rebuildMovementDayDescriptionWithoutTourismWording(lines, joined, day, maxDay)
  return out2
}

function buildHanatourTourismDayDescription(
  lines: string[],
  joined: string,
  title: string,
  day: number,
  maxDay: number
): string {
  const parts = title.split(/\s*-\s*/).map((s) => s.trim()).filter((s) => s.length >= 2)
  const geo = primaryGeoToken(joined, title) ?? ''
  let core = ''
  if (parts.length >= 4) {
    const lead = parts.slice(0, 4).join(', ')
    const g = geo || parts[0]!
    core = `${lead} 등 ${g} 일대를 순서대로 둘러본 뒤 관광과 이동을 이어가며 당일 일정을 마무리합니다.`
  } else if (parts.length === 3) {
    core = `${parts[0]}, ${parts[1]}, ${parts[2]} 일대를 연속으로 둘러본 뒤 동선을 따라 관광과 이동을 마무리합니다.`
  } else if (parts.length === 2) {
    core = `${parts[0]}와 ${parts[1]} 일대를 차례로 둘러본 뒤 당일 관광과 이동을 마무리합니다.`
  } else if (parts.length === 1) {
    const head = findHanatourItineraryHeadline(lines)
    const seg = headlineTourismSegments(head)
    if (seg.length >= 2) core = `${parts[0]} ${seg[0]}, ${seg[1]} 등을 둘러본 뒤 일정을 마무리합니다.`
    else core = `${parts[0]} 중심으로 당일 코스를 관광합니다.`
  } else {
    const head = findHanatourItineraryHeadline(lines)
    const seg = headlineTourismSegments(head)
    if (seg.length >= 3) core = `${seg.slice(0, 3).join(', ')} 등을 둘러본 뒤 일정을 마무리합니다.`
    else if (seg.length === 2) core = `${seg[0]}와 ${seg[1]} 일대를 둘러본 뒤 일정을 마무리합니다.`
    else
      return hanatourTrimOneSentenceMax(
        hanatourEnsureDescriptionMinLength(hanatourTourismDescriptionFallback(joined, title, day, maxDay), lines),
        HANATOUR_CARD_DESCRIPTION_MAX
      )
  }
  return hanatourTrimOneSentenceMax(hanatourEnsureDescriptionMinLength(core, lines), HANATOUR_CARD_DESCRIPTION_MAX)
}

function inferHanatourReturnHomeDay(day: number, maxDay: number, joined: string): boolean {
  const j = joined.slice(0, 8000)
  return (
    day === maxDay &&
    maxDay >= 2 &&
    /(인천|ICN|김포|GMP)/.test(j) &&
    /(출발|귀국|탑승)/.test(j) &&
    /(상해|PVG|푸동|연길|YNJ)/.test(j)
  )
}

function buildDenseReturnHomeDescription(joined: string, maxDay: number): string {
  const j = joined.slice(0, 8000)
  const origin = /상해|PVG|푸동/.test(j) ? '상해' : /연길|YNJ/.test(j) ? '연길' : '현지'
  return `${origin} 쪽 공항에서 국제선에 탑승한 뒤 인천국제공항으로 귀국하며, 비행·출국 심사와 탑승 동선을 마친 뒤 막일 공항 일정을 끝내고 ${maxDay}일차 전체 여정을 마무리합니다.`.replace(/\s+/g, ' ')
}

/** 이동일 설명에 들어가면 안 되는 관광형 표현(포함 시 재생성). */
const HANATOUR_MOVEMENT_DESC_FORBIDDEN_TOURISM_RE =
  /(관광합니다|둘러봅니다|둘러본\s*뒤|탐방합니다|방문합니다|핵심\s*일정을\s*중심으로\s*관광합니다|일대를\s*둘러본\s*뒤\s*일정을\s*마무리합니다|당일\s*관광|관광과\s*이동을\s*이어가며\s*당일\s*관광|핵심\s*코스를\s*관광|명소를\s*방문)/

function movementDescriptionHasForbiddenTourismWording(s: string): boolean {
  return HANATOUR_MOVEMENT_DESC_FORBIDDEN_TOURISM_RE.test(s)
}

function rebuildMovementDayDescriptionWithoutTourismWording(
  lines: string[],
  joined: string,
  day: number,
  maxDay: number
): string {
  const arrivalish = day === 1 || /입국|도착|공항/.test(joined.slice(0, 4000))
  const base = arrivalish
    ? buildDenseMovementArrivalDescription(joined, lines)
    : hanatourMovementDescriptionFallback(joined, day, maxDay)
  return hanatourTrimOneSentenceMax(hanatourEnsureDescriptionMinLength(base, lines, true), HANATOUR_CARD_DESCRIPTION_MAX)
}

function buildDenseMovementArrivalDescription(joined: string, lines: string[]): string {
  const j = joined.slice(0, 8000)
  const airport = /푸동국제공항|PVG|푸동/.test(j) ? '푸동국제공항' : /김포|GMP/.test(j) ? '김포공항' : /상해/.test(j) ? '상해 공항' : '현지 공항'
  let s = ''
  if (/하나투어\s*미팅|미팅\s*피켓|피켓/.test(j)) {
    s = `${airport}에 입국한 뒤 하나투어 미팅 피켓 앞에서 가이드 미팅을 진행하고, 이후 일정상 체류 지역으로 이동합니다.`
  } else if (/가이드\s*미팅|미팅/.test(j)) {
    s = `${airport}에 입국한 뒤 가이드 미팅 장소에서 미팅을 진행하고, 이후 일정상 체류 지역으로 이동합니다.`
  } else {
    s = `${airport}에 입국한 뒤 공항 절차를 마치고 현지 미팅 포인트로 이동한 뒤, 이어서 일정상 체류 지역으로 이동합니다.`
  }
  let out = s.replace(/\s+/g, ' ')
  const ml = pickBestHanatourMotionSummaryLine(lines)
  if (ml) {
    const hint = stripLeadingHanatourDatePrefix(ml).replace(/\s+/g, ' ').trim()
    if (
      hint.length >= 16 &&
      hint.length <= 96 &&
      !/(조식|중식|석식|호텔\s*[:：])/i.test(hint) &&
      !/(관광|둘러보|탐방|방문|명소|유람)/.test(hint)
    ) {
      out = `${hint} 내용을 반영해 ${out.charAt(0).toLowerCase()}${out.slice(1)}`
    }
  }
  return out
}

function buildDenseTourismDescriptionFromPois(joined: string, title: string): string {
  const pois = extractOrderedKnownPoiFromJoined(joined)
  const titleParts = title.split(/\s*-\s*/).map((s) => s.trim()).filter((s) => s.length >= 2)
  const ordered = [...new Set([...titleParts, ...pois])].filter(Boolean).slice(0, 6)
  const geo = primaryGeoToken(joined, title) ?? ''
  if (ordered.length >= 5) {
    const a = ordered.slice(0, 3).join(', ')
    const b = ordered.slice(3, 5).join(', ')
    return `${geo ? `${geo} ` : ''}${a}와 ${b}를 잇는 동선으로 둘러본 뒤 당일 관광과 이동을 마무리합니다.`.replace(/\s+/g, ' ')
  }
  if (ordered.length >= 4) {
    const a = ordered.slice(0, 2).join(', ')
    const b = ordered.slice(2, 4).join(', ')
    return `${geo ? `${geo} ` : ''}${a}, ${b} 일대를 연속으로 둘러본 뒤 관광과 이동을 이어가며 일정을 마무리합니다.`.replace(/\s+/g, ' ')
  }
  if (ordered.length === 3) {
    return `${geo ? `${geo} ` : ''}${ordered[0]}, ${ordered[1]}, ${ordered[2]}를 순서대로 둘러본 뒤 당일 동선을 따라 관광을 마무리합니다.`.replace(/\s+/g, ' ')
  }
  if (ordered.length === 2) {
    return `${geo ? `${geo} ` : ''}${ordered[0]}와 ${ordered[1]} 일대를 차례로 둘러본 뒤 이동과 관람을 이어가며 일정을 정리합니다.`.replace(/\s+/g, ' ')
  }
  return `${geo || '현지'} 당일 예정 코스를 따라 둘러본 뒤 관광과 이동을 마무리합니다.`
}

/**
 * 1문장 유지. 90자 미만·유형별 정보 부족 시 코드로 밀도만 보강한다(호텔명·식사 메뉴 없음).
 */
function finalizeHanatourCardDescriptionInformation(
  desc: string,
  movementDay: boolean,
  returnHome: boolean,
  day: number,
  maxDay: number,
  lines: string[],
  joined: string,
  title: string
): string {
  let core = desc.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim().replace(/\.$/, '')
  const L = () => core.length

  if (L() > HANATOUR_CARD_DESCRIPTION_MAX) {
    return hanatourTrimOneSentenceMax(`${core}.`, HANATOUR_CARD_DESCRIPTION_MAX)
  }

  if (returnHome) {
    if (L() < HANATOUR_CARD_DESCRIPTION_MIN || !/(귀국|인천)/.test(core) || /(관광합니다|핵심\s*코스)/.test(core)) {
      core = buildDenseReturnHomeDescription(joined, maxDay).replace(/\.$/, '')
    }
    if (L() < HANATOUR_CARD_DESCRIPTION_MIN) {
      core = `${core.replace(/\.$/, '')}, 탑승과 출국 절차를 마친 뒤 국제선 동선을 마무리합니다.`.replace(/\s+/g, ' ').replace(/\.$/, '')
    }
  } else if (movementDay) {
    const badTourismInMovement =
      movementDescriptionHasForbiddenTourismWording(core) ||
      /일대를\s*둘러본|핵심\s*코스를\s*관광|핵심\s*일정을\s*중심으로/.test(core)
    if (L() < HANATOUR_CARD_DESCRIPTION_MIN || badTourismInMovement) {
      const arrivalish = day === 1 || /입국|도착|공항/.test(joined.slice(0, 4000))
      core = (arrivalish ? buildDenseMovementArrivalDescription(joined, lines) : hanatourMovementDescriptionFallback(joined, day, maxDay)).replace(
        /\.$/,
        ''
      )
    }
    if (L() < HANATOUR_CARD_DESCRIPTION_MIN) {
      core = hanatourEnsureDescriptionMinLength(`${core}.`, lines, true).replace(/\.$/, '')
    }
    if (movementDescriptionHasForbiddenTourismWording(core)) {
      core = rebuildMovementDayDescriptionWithoutTourismWording(lines, joined, day, maxDay).replace(/\.$/, '')
    }
  } else {
    if (L() < HANATOUR_CARD_DESCRIPTION_MIN || /핵심\s*일정을\s*중심으로/.test(core)) {
      core = buildDenseTourismDescriptionFromPois(joined, title).replace(/\.$/, '')
    }
    if (L() < HANATOUR_CARD_DESCRIPTION_TARGET && extractOrderedKnownPoiFromJoined(joined).length >= 4) {
      const alt = buildDenseTourismDescriptionFromPois(joined, title).replace(/\.$/, '')
      if (alt.length > L()) core = alt
    }
    if (L() < HANATOUR_CARD_DESCRIPTION_MIN) {
      core = hanatourEnsureDescriptionMinLength(
        `${hanatourTourismDescriptionFallback(joined, title, day, maxDay)}`,
        lines
      ).replace(/\.$/, '')
    }
  }

  let out = core.trim()
  if (!/[.!?…]$/.test(out)) out = `${out}.`
  return hanatourTrimOneSentenceMax(out, HANATOUR_CARD_DESCRIPTION_MAX)
}

/**
 * 일정 카드 description: 항상 한국어 1문장·일정 흐름만. 호텔·식사·장문 dump 금지. title 과 과도 중복 금지.
 */
function composeHanatourScheduleDescriptionSentence(
  lines: string[],
  joined: string,
  day: number,
  maxDay: number,
  movementTitle: string | null,
  title: string
): string {
  const tourismEvidence = hanatourJoinedHasTourismEvidence(joined)
  const movementStrong = hanatourMovementSignalsStrong(joined, day)
  let movementDay = Boolean(movementTitle) || isHanatourMovementPatternDay(joined, day, maxDay)
  if (day === 1 && movementStrong && !tourismEvidence) movementDay = true
  const returnHome = inferHanatourReturnHomeDay(day, maxDay, joined)
  let desc = movementDay
    ? buildHanatourMovementDayDescription(lines, joined, day, maxDay)
    : buildHanatourTourismDayDescription(lines, joined, title, day, maxDay)
  if (
    desc.length < HANATOUR_CARD_DESCRIPTION_MIN ||
    hanatourDescriptionOverlapsTitle(title, desc)
  ) {
    desc = hanatourEnsureDescriptionMinLength(
      movementDay
        ? hanatourMovementDescriptionFallback(joined, day, maxDay)
        : hanatourTourismDescriptionFallback(joined, title, day, maxDay),
      lines
    )
  }
  if (hanatourDescriptionOverlapsTitle(title, desc)) {
    desc = hanatourEnsureDescriptionMinLength(
      movementDay
        ? hanatourMovementDescriptionFallback(joined, day, maxDay)
        : hanatourTourismDescriptionFallback(joined, title, day, maxDay),
      lines
    )
    if (hanatourDescriptionOverlapsTitle(title, desc)) {
      desc = hanatourTrimOneSentenceMax(
        hanatourEnsureDescriptionMinLength(
          movementDay
            ? '공항·구간 이동에 따라 당일 동선을 진행합니다.'
            : '관광·이동 순서에 따라 당일 일정을 진행합니다.',
          lines
        ),
        HANATOUR_CARD_DESCRIPTION_MAX
      )
    }
  }
  if (/핵심\s*일정을\s*중심으로\s*관광합니다/.test(desc) && isHanatourMovementPatternDay(joined, day, maxDay)) {
    desc = buildHanatourMovementDayDescription(lines, joined, day, maxDay)
  }
  desc = finalizeHanatourCardDescriptionInformation(desc, movementDay, returnHome, day, maxDay, lines, joined, title)
  return hanatourTrimOneSentenceMax(desc, HANATOUR_CARD_DESCRIPTION_MAX)
}

function inferHanatourImageKeyword(day: number, maxDay: number, rawBlob: string): string {
  return hanatourEnglishPexelsImageKeywordFromBlob(rawBlob, day, maxDay).slice(0, 120)
}

function hanatourTitleLooksLikePlaceRoute(t: string): boolean {
  const s = t.trim()
  if (!s || s.length > 80) return false
  if (DAY_N_TRAVEL_RE.test(s)) return false
  if (isHanatourDateLikeScheduleToken(s)) return false
  if (/\d{1,2}\/\d{1,2}/.test(s)) return false
  if (/일차\s*동선$/.test(s)) return false
  if (/출발\s*및|및\s*.*도착|출발\s*및\s*인천/.test(s)) return false
  if (HANATOUR_TITLE_FORBIDDEN.has(s.toLowerCase())) return false
  if (/ - /.test(s)) {
    const parts = s.split(/\s*-\s*/).map((p) => p.trim()).filter(Boolean)
    return parts.length >= 2 && parts.every((p) => p.length >= 2 && p.length <= 24)
  }
  return s.length >= 2 && s.length <= 24
}

function hanatourTitleNeedsReplace(title: string, description?: string): boolean {
  const t = title.trim()
  if (!t) return true
  if (isHanatourDateLikeScheduleToken(t)) return true
  if (HANATOUR_TITLE_FORBIDDEN.has(t.toLowerCase())) return true
  if (DAY_N_TRAVEL_RE.test(t)) return true
  if (/\r?\n/.test(t)) return true
  if (!hanatourTitleLooksLikePlaceRoute(t)) return true
  const d = description?.trim() ?? ''
  if (d && t === d) return true
  return false
}

function hanatourDescriptionNeedsReplace(desc: string, title?: string): boolean {
  if (!desc.trim()) return true
  if (desc.trim().length < HANATOUR_CARD_DESCRIPTION_MIN) return true
  if (desc.length > HANATOUR_CARD_DESCRIPTION_MAX) return true
  if (hanatourDescriptionLooksLikeDetailDump(desc)) return true
  if (/이전다음|상세보기|상세내용을 확인/.test(desc)) return true
  if (/핵심\s*일정을\s*중심으로\s*관광합니다/.test(desc)) return true
  if (/식사\s|조식|중식|석식|홀리데이|Holiday\s*Inn|호텔\s*투숙|호텔식|딤섬|예정\s*호텔|숙박\s*없음/i.test(desc)) return true
  const ti = title?.trim() ?? ''
  if (ti && ti === desc.trim()) return true
  if (ti && hanatourDescriptionOverlapsTitle(ti, desc.trim())) return true
  return false
}

function hanatourImageKeywordNeedsReplace(kw: string): boolean {
  const k = kw.trim()
  if (!k) return true
  if (!isLikelyEnglishPexelsKeyword(k)) return true
  return false
}

export function polishHanatourScheduleDayFromRawBody(
  day: number,
  maxDay: number,
  rawBody: string
): RegisterScheduleDay {
  const lines = stripHanatourScheduleNoiseLines(rawBody)
  const joined = lines.join('\n')
  const meals = extractHanatourMealsFromScheduleBlock(rawBody)
  const hotel = extractHanatourHotelFromScheduleBlock(rawBody)
  const movementTitle = inferHanatourMovementTitle(joined, day, maxDay)
  const title = buildHanatourCardPlaceTitle(day, maxDay, lines, joined)
  const description = composeHanatourScheduleDescriptionSentence(
    lines,
    joined,
    day,
    maxDay,
    movementTitle,
    title
  )
  const imageKeyword = inferHanatourImageKeyword(day, maxDay, rawBody)
  return {
    day,
    title,
    description,
    imageKeyword: imageKeyword.slice(0, 120),
    breakfastText: meals.breakfastText ?? null,
    lunchText: meals.lunchText ?? null,
    dinnerText: meals.dinnerText ?? null,
    mealSummaryText: meals.mealSummaryText ?? null,
    hotelText: hotel.hotelText ?? null,
  }
}

export function polishHanatourScheduleDayForItinerary(
  row: RegisterScheduleDay,
  maxDay: number
): RegisterScheduleDay {
  const rawBlob = [row.title, row.description, row.imageKeyword].filter(Boolean).join('\n')
  const rebuilt = polishHanatourScheduleDayFromRawBody(row.day, maxDay, rawBlob)
  const descTooLong = row.description.trim().length > HANATOUR_CARD_DESCRIPTION_MAX
  const titleTrim = row.title.trim().slice(0, 200)
  const descTrim = row.description.trim()
  const title = hanatourTitleNeedsReplace(row.title, descTrim) ? rebuilt.title : titleTrim
  let descriptionRaw =
    hanatourDescriptionNeedsReplace(row.description, title) || descTooLong ? rebuilt.description : descTrim
  if (hanatourDescriptionOverlapsTitle(title, descriptionRaw)) {
    const lines2 = stripHanatourScheduleNoiseLines(rawBlob)
    const joined2 = lines2.join('\n')
    const movementTitle2 = inferHanatourMovementTitle(joined2, row.day, maxDay)
    descriptionRaw = composeHanatourScheduleDescriptionSentence(
      lines2,
      joined2,
      row.day,
      maxDay,
      movementTitle2,
      title
    )
  }
  const description = descriptionRaw.slice(0, HANATOUR_CARD_DESCRIPTION_MAX).trim()
  const imageKeyword = hanatourImageKeywordNeedsReplace(row.imageKeyword)
    ? rebuilt.imageKeyword
    : row.imageKeyword.trim().slice(0, 120)
  return {
    ...row,
    title: title.slice(0, 200).trim(),
    description,
    imageKeyword,
    breakfastText: row.breakfastText?.trim() || rebuilt.breakfastText || null,
    lunchText: row.lunchText?.trim() || rebuilt.lunchText || null,
    dinnerText: row.dinnerText?.trim() || rebuilt.dinnerText || null,
    mealSummaryText: row.mealSummaryText?.trim() || rebuilt.mealSummaryText || null,
    hotelText: row.hotelText?.trim() || rebuilt.hotelText || null,
  }
}

export function polishHanatourScheduleDaysForItinerary(schedule: RegisterScheduleDay[]): RegisterScheduleDay[] {
  const maxDay = schedule.length ? Math.max(1, ...schedule.map((s) => s.day)) : 1
  return schedule.map((r) => polishHanatourScheduleDayForItinerary(r, maxDay))
}

function scoreHanatourScheduleChunkBody(body: string): number {
  const t = body.trim()
  if (!t) return 0
  const ls = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const head = [ls[0] ?? '', ls[1] ?? '', ls[2] ?? ''].join('\n').slice(0, 200)
  const dateLike = /\d{1,2}\/\d{1,2}\s*\([월화수목금토일]\)/.test(head)
  return (dateLike ? 100_000 : 0) + Math.min(t.length, 50_000)
}

/**
 * `schedule_section`에서 일차별로 가장 신뢰도 높은 원문 블록(점수 최고)만 모은다.
 */
export function gatherHanatourScheduleSectionBodiesByDay(detailBody: DetailBodyParseSnapshot): Map<number, string> {
  const parts = detailBody.sections
    .filter((s) => s.type === 'schedule_section')
    .map((s) => s.text.trim())
    .filter(Boolean)
  if (!parts.length) return new Map()

  const lines = parts.join('\n\n').split(/\r?\n/)
  const startDayFromLine = (line: string): number | null => {
    const m1 = line.match(/^\s*(\d{1,2})\s*일차/i)
    if (m1) return parseInt(m1[1]!, 10)
    const m2 = line.match(/^\s*DAY\s*(\d{1,2})\b/i)
    if (m2) return parseInt(m2[1]!, 10)
    return null
  }
  const stripDayHeader = (line: string): string =>
    line
      .replace(/^\s*\d{1,2}\s*일차\s*/i, '')
      .replace(/^\s*DAY\s*\d{1,2}\s*/i, '')
      .trim()

  let currentDay = 0
  const buf: string[] = []
  const chunks: { day: number; body: string }[] = []

  for (const line of lines) {
    const d = startDayFromLine(line)
    if (d != null && d >= 1) {
      if (currentDay > 0) {
        chunks.push({ day: currentDay, body: buf.join('\n').trim() })
      }
      currentDay = d
      buf.length = 0
      const rest = stripDayHeader(line)
      if (rest) buf.push(rest)
    } else if (currentDay > 0) {
      buf.push(line)
    }
  }
  if (currentDay > 0) {
    chunks.push({ day: currentDay, body: buf.join('\n').trim() })
  }

  const bestByDay = new Map<number, { day: number; body: string; score: number }>()
  for (const ch of chunks) {
    const score = scoreHanatourScheduleChunkBody(ch.body)
    const prev = bestByDay.get(ch.day)
    if (!prev || score > prev.score) bestByDay.set(ch.day, { day: ch.day, body: ch.body, score })
  }
  const out = new Map<number, string>()
  for (const v of bestByDay.values()) out.set(v.day, v.body)
  return out
}

/**
 * LLM 일정 행에 대해, 같은 일차의 `schedule_section` 원문이 있으면 그 본문으로 카드 title·description을 다시 만든다.
 */
export function polishHanatourScheduleRowsPreferDetailBody(
  rows: RegisterScheduleDay[],
  detailBody: DetailBodyParseSnapshot | null | undefined
): RegisterScheduleDay[] {
  if (!rows.length) return rows
  const bodies = detailBody ? gatherHanatourScheduleSectionBodiesByDay(detailBody) : new Map<number, string>()
  const dayNums = rows.map((r) => Math.max(1, Number(r.day) || 1))
  const maxDay = Math.max(1, ...dayNums, ...[...bodies.keys()])
  return rows.map((row) => {
    const day = Math.max(1, Number(row.day) || 1)
    const chunk = bodies.get(day)?.trim() ?? ''
    if (chunk.length >= 36) {
      const polished = polishHanatourScheduleDayFromRawBody(day, maxDay, chunk)
      return {
        ...polished,
        day: row.day,
        breakfastText: polished.breakfastText?.trim() || row.breakfastText?.trim() || null,
        lunchText: polished.lunchText?.trim() || row.lunchText?.trim() || null,
        dinnerText: polished.dinnerText?.trim() || row.dinnerText?.trim() || null,
        mealSummaryText: polished.mealSummaryText?.trim() || row.mealSummaryText?.trim() || null,
        hotelText: polished.hotelText?.trim() || row.hotelText?.trim() || null,
      }
    }
    return polishHanatourScheduleDayForItinerary(row, maxDay)
  })
}

/**
 * 미리보기용: `schedule_section` 본문에서 `N일차` / `DAY N` 경계만 보고 최소 `RegisterScheduleDay[]`를 만든다.
 * (LLM 일정 미출력·`finalizePreviewRegisterRaw`에서 schedule을 비우지 않을 때 상류 보강.)
 */
export function buildPreviewHanatourScheduleFromDetailBody(detailBody: DetailBodyParseSnapshot): RegisterScheduleDay[] {
  const byDay = gatherHanatourScheduleSectionBodiesByDay(detailBody)
  if (!byDay.size) return []
  const orderedDays = [...byDay.keys()].sort((a, b) => a - b)
  const maxDay = Math.max(...orderedDays)
  return orderedDays.map((d) => polishHanatourScheduleDayFromRawBody(d, maxDay, byDay.get(d)!))
}

function isPlaceholderHotel(ht: string): boolean {
  const t = ht.trim()
  return !t || t === '-' || t === '—' || t === '–'
}

/** imageKeyword가 Pexels용 영문 noun phrase가 아니면 title·description·기존값으로 재생성 */
export function sanitizeHanatourScheduleRowExpression(
  row: RegisterScheduleDay,
  maxDay: number = 7
): RegisterScheduleDay {
  const day = Math.max(1, Number(row.day) || 1)
  const blob = `${String(row.title ?? '')}\n${String(row.description ?? '')}\n${String(row.imageKeyword ?? '')}`
  const kw0 = String(row.imageKeyword ?? '').trim()
  if (isLikelyEnglishPexelsKeyword(kw0)) return { ...row }
  return {
    ...row,
    imageKeyword: hanatourEnglishPexelsImageKeywordFromBlob(blob, day, maxDay).slice(0, 120),
  }
}

export function augmentHanatourScheduleExpressionParsed(parsed: RegisterParsed): RegisterParsed {
  const sched = parsed.schedule
  if (!sched?.length) return parsed
  const maxDay = Math.max(1, ...sched.map((s) => s.day))
  return {
    ...parsed,
    schedule: sched.map((r) =>
      sanitizeHanatourScheduleRowExpression(stripCounselingTermsFromScheduleRow(r), maxDay)
    ),
  }
}

/** 하나투어 일정 카드 title/description 제미나이 polish용 일차 유형(코드가 먼저 분류). */
export type HanatourScheduleCardDayKind = 'movement' | 'tourism' | 'return_home'

function isHanatourScheduleCardGeminiPolishGloballyEnabled(): boolean {
  if (process.env.HANATOUR_SCHEDULE_CARD_GEMINI_POLISH === '0') return false
  return Boolean((process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim())
}

function classifyHanatourScheduleCardDayKind(
  day: number,
  maxDay: number,
  joined: string
): HanatourScheduleCardDayKind {
  const j = joined.slice(0, 12_000)
  if (
    day === maxDay &&
    maxDay >= 2 &&
    /(인천|ICN|김포|GMP)/.test(j) &&
    /(출발|귀국|탑승)/.test(j) &&
    /(상해|PVG|푸동|연길|YNJ)/.test(j)
  ) {
    return 'return_home'
  }
  if (inferHanatourMovementTitle(j, day, maxDay) != null || isHanatourMovementPatternDay(j, day, maxDay)) {
    return 'movement'
  }
  return 'tourism'
}

function mergeHanatourPlaceCandidatesFromTitleAndJoined(title: string, joined: string): string[] {
  const fromTitle = title
    .split(/\s*-\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 24)
  const fromJoined = extractOrderedKnownPoiFromJoined(joined)
  const out: string[] = []
  const seen = new Set<string>()
  for (const s of [...fromTitle, ...fromJoined]) {
    const k = s.trim()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(k)
    if (out.length >= 8) break
  }
  return out
}

function extractHanatourCityCandidates(joined: string): string[] {
  const j = joined.slice(0, 8000)
  const hits = j.match(/(연길|상해|주가각|인천|푸동|YNJ|PVG|김포|GMP|방콕|도쿄|파리|백두산|장백)/gi) ?? []
  const out: string[] = []
  const seen = new Set<string>()
  for (const h of hits) {
    const u = h.trim()
    if (!u || seen.has(u)) continue
    seen.add(u)
    out.push(u)
    if (out.length >= 6) break
  }
  return out
}

function extractHanatourMovementCueLine(lines: string[]): string {
  const ml = pickBestHanatourMotionSummaryLine(lines)
  return (ml ?? '').replace(/\s+/g, ' ').trim().slice(0, 160)
}

function shouldHanatourScheduleCardInvokeGeminiPolish(
  row: RegisterScheduleDay,
  joined: string,
  kind: HanatourScheduleCardDayKind,
  placeCandidates: string[]
): boolean {
  const t = row.title.trim()
  const d = row.description.trim()
  const genericDesc =
    /핵심\s*일정을\s*중심으로\s*관광합니다/.test(d) ||
    /일정표에\s*따라\s*(관광·이동을\s*진행합니다|이동·관광을\s*진행합니다|관광합니다)/.test(d) ||
    /관광·이동\s*순서에\s*따라/.test(d) ||
    /공항·구간\s*이동에\s*따라/.test(d)
  const titleWeak =
    !hanatourTitleLooksLikePlaceRoute(t) || t === '일차 동선' || t.length < 5 || t.length > 48
  const descLenWeak = d.length < HANATOUR_CARD_DESCRIPTION_MIN || d.length > HANATOUR_CARD_DESCRIPTION_MAX
  const returnMismatch =
    kind === 'return_home' && (!/(귀국|인천으로|인천\s*로|출발해\s*인천)/.test(d) || /(핵심\s*일정|핵심\s*코스를\s*관광)/.test(d))
  const movementTourismMismatch =
    kind === 'movement' &&
    (/(핵심\s*일정을\s*중심으로|핵심\s*코스를\s*관광합니다)/.test(d) || movementDescriptionHasForbiddenTourismWording(d))
  const movementThin =
    kind === 'movement' &&
    d.length < HANATOUR_CARD_DESCRIPTION_MIN &&
    !/(입국|미팅|공항|도착|탑승|출발|귀국|인천)/.test(d)
  const returnThin = kind === 'return_home' && d.length < HANATOUR_CARD_DESCRIPTION_MIN
  const tourismThin =
    kind === 'tourism' &&
    placeCandidates.length >= 3 &&
    d.length < HANATOUR_CARD_DESCRIPTION_TARGET &&
    !placeCandidates.slice(0, 4).some((p) => d.includes(p))
  const tourismFewPlaces =
    kind === 'tourism' &&
    placeCandidates.length >= 4 &&
    placeCandidates.slice(0, 4).filter((p) => d.includes(p)).length < 2 &&
    d.length < HANATOUR_CARD_DESCRIPTION_TARGET
  if (
    genericDesc ||
    titleWeak ||
    descLenWeak ||
    returnMismatch ||
    movementTourismMismatch ||
    movementThin ||
    returnThin ||
    tourismThin ||
    tourismFewPlaces
  )
    return true
  if (hanatourDescriptionOverlapsTitle(t, d) && placeCandidates.length >= 2) return true
  return false
}

function validateHanatourGeminiCardPolishOutput(
  title: string,
  description: string,
  kind: HanatourScheduleCardDayKind
): { title: string; description: string } | null {
  const t = title.replace(/\s+/g, ' ').trim()
  const d = description.replace(/\s+/g, ' ').trim()
  if (t.length < 12 || t.length > 40) return null
  if (d.length < HANATOUR_CARD_DESCRIPTION_MIN || d.length > HANATOUR_CARD_DESCRIPTION_MAX) return null
  if (isHanatourDateLikeScheduleToken(t)) return null
  if (DAY_N_TRAVEL_RE.test(t)) return null
  const forbid =
    /(조식|중식|석식|호텔\s*투숙|예정\s*호텔|Holiday\s*Inn|홀리데이\s*인|딤섬|일정표_|상세보기|이전다음|요금\s*:|소요시간|대체일정|\[TIP\]|※\s*※)/i
  if (forbid.test(t) || forbid.test(d)) return null
  if (!d.endsWith('.')) return null
  if (kind === 'return_home') {
    if (!/(귀국|인천)/.test(d)) return null
    if (/(관광합니다|핵심\s*코스)/.test(d)) return null
  }
  if (kind === 'movement' && (/핵심\s*일정을\s*중심으로\s*관광합니다/.test(d) || movementDescriptionHasForbiddenTourismWording(d)))
    return null
  if (kind === 'return_home' && movementDescriptionHasForbiddenTourismWording(d)) return null
  if (kind === 'tourism' && /(입국\s*후\s*귀국|인천으로\s*귀국합니다)/.test(d) && !/(관광|둘러본|코스)/.test(d)) return null
  return { title: t.slice(0, 80), description: d.slice(0, HANATOUR_CARD_DESCRIPTION_MAX) }
}

const HANATOUR_CARD_GEMINI_POLISH_TIMEOUT_MS = Math.min(
  45_000,
  Math.max(12_000, Number(process.env.HANATOUR_SCHEDULE_CARD_GEMINI_TIMEOUT_MS) || 22_000)
)

/**
 * 규칙 기반으로 만든 일정 카드 1행에 대해, 필요할 때만 제미나이로 title·description 문장만 다듬는다.
 * 실패·검증 실패 시 `row` 그대로 반환한다. hotel·식사·imageKeyword는 변경하지 않는다.
 */
export async function polishHanatourScheduleRowTitleDescriptionWithGeminiIfNeeded(
  row: RegisterScheduleDay,
  ctx: {
    maxDay: number
    dayBlockRefined: string
    lines: string[]
    joined: string
  }
): Promise<RegisterScheduleDay> {
  if (!isHanatourScheduleCardGeminiPolishGloballyEnabled()) return row
  const day = Math.max(1, Number(row.day) || 1)
  const { maxDay, dayBlockRefined, lines, joined } = ctx
  const kind = classifyHanatourScheduleCardDayKind(day, maxDay, joined)
  const placeCandidates = mergeHanatourPlaceCandidatesFromTitleAndJoined(row.title, joined)
  const cityCandidates = extractHanatourCityCandidates(joined)
  const movementCue = extractHanatourMovementCueLine(lines)
  if (!shouldHanatourScheduleCardInvokeGeminiPolish(row, joined, kind, placeCandidates)) return row

  const forbiddenList = [
    '상세보기',
    '이전다음',
    '1/2이전다음',
    '일정표_',
    '요금',
    '소요시간',
    'TIP',
    '조식',
    '중식',
    '석식',
    '호텔명',
    'Holiday Inn',
    '큐알',
  ]
  const payload = {
    day,
    maxDay,
    day_kind: kind === 'return_home' ? '귀국일' : kind === 'movement' ? '이동일' : '관광일',
    city_candidates: cityCandidates,
    place_candidates: placeCandidates,
    movement_cue: movementCue || null,
    code_title_draft: row.title.trim().slice(0, 200),
    code_description_draft: row.description.trim().slice(0, 200),
    day_block_refined: dayBlockRefined.slice(0, 2800),
    forbidden_phrases: forbiddenList,
    reference_hotel_text: row.hotelText?.trim().slice(0, 120) ?? null,
    reference_meals_one_line: [row.breakfastText, row.lunchText, row.dinnerText].filter(Boolean).join(' / ').slice(0, 160) || null,
    instructions:
      '참고용 hotel/meals는 title·description에 넣지 말 것. JSON만 출력: {"title":"...","description":"..."}. title 12–40자 장소·동선 요약, description 한 문장 90–150자(목표 100–140자) 마침표로 끝.',
  }

  const systemPreamble = `역할: 하나투어 일정 카드용 한국어 카피 편집만 한다.
출력은 반드시 JSON 객체 하나이며 키는 title, description 만 허용한다.
구조화·추출은 이미 서버가 했다. 너는 받은 day_kind·place_candidates·day_block_refined에 맞춰 문장만 다듬는다.
귀국일이면 귀국·인천 도착 흐름만. 이동일이면 입국·미팅·공항·이동 등 관광 나열 금지. 관광일이면 장소 2~4개가 자연스럽게 드러나게.
description은 한 문장·90~150자(가능하면 100~140자)로 정보량을 채운다.
title·description에 호텔명·식사 메뉴·요금·소요시간·TIP·상세보기·슬라이더·일정표_류는 넣지 않는다.
날짜만 title 금지. placeholder·일차 동선 금지.`

  try {
    const model = getGenAI().getGenerativeModel({ model: getModelName() })
    const userText = `${systemPreamble}\n\n입력(JSON):\n${JSON.stringify(payload)}`
    const result = await model.generateContent(
      {
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 512,
          ...( { responseMimeType: 'application/json' } as { responseMimeType?: string }),
        },
      },
      geminiTimeoutOpts(HANATOUR_CARD_GEMINI_POLISH_TIMEOUT_MS)
    )
    const text = result.response.text()
    const obj = parseLlmJsonObject<Record<string, unknown>>(text, { logLabel: 'hanatour-schedule-card-polish' })
    const nt = String(obj.title ?? '').trim()
    const nd = String(obj.description ?? '').trim()
    const ok = validateHanatourGeminiCardPolishOutput(nt, nd, kind)
    if (!ok) return row
    return {
      ...row,
      title: ok.title,
      description: ok.description,
    }
  } catch {
    return row
  }
}

/**
 * schedule 전체에 대해 일차별로 조건부 제미나이 카드 문장 polish를 적용한다.
 */
export async function polishHanatourScheduleRowsGeminiCardTextIfNeeded(
  rows: RegisterScheduleDay[],
  detailBody: DetailBodyParseSnapshot | null | undefined,
  opts?: { onTiming?: (label: string) => void }
): Promise<RegisterScheduleDay[]> {
  if (!rows.length || !isHanatourScheduleCardGeminiPolishGloballyEnabled()) return rows
  const bodies = detailBody ? gatherHanatourScheduleSectionBodiesByDay(detailBody) : new Map<number, string>()
  const maxDay = Math.max(1, ...rows.map((r) => Math.max(1, Number(r.day) || 1)))
  const out: RegisterScheduleDay[] = []
  for (const row of rows) {
    const day = Math.max(1, Number(row.day) || 1)
    const rawBlock = (bodies.get(day)?.trim() || `${row.title}\n${row.description}`).trim().slice(0, 8000)
    const lines = stripHanatourScheduleNoiseLines(rawBlock)
    const joined = lines.join('\n')
    opts?.onTiming?.(`hanatour-card-gemini-polish-day-${day}`)
    const next = await polishHanatourScheduleRowTitleDescriptionWithGeminiIfNeeded(row, {
      maxDay,
      dayBlockRefined: rawBlock.slice(0, 2800),
      lines,
      joined,
    })
    out.push(next)
  }
  return out
}

/**
 * `parsed.schedule`를 ItineraryDay 초안의 단일 소스로 삼고, hotelText가 있으면 accommodation을 맞춘다.
 * schedule이 비어 있으면 기존 drafts를 그대로 둔다.
 */
export function finalizeHanatourItineraryDayDraftsFromSchedule(
  _drafts: ItineraryDayInput[],
  schedule: RegisterScheduleDay[]
): ItineraryDayInput[] {
  if (!schedule?.length) return _drafts
  const fromSchedule = registerScheduleToDayInputs(schedule.map(stripCounselingTermsFromScheduleRow))
  return fromSchedule.map((d) => {
    const ht = d.hotelText?.trim()
    if (isPlaceholderHotel(ht ?? '')) return d
    return { ...d, accommodation: ht!.slice(0, 500) }
  })
}
