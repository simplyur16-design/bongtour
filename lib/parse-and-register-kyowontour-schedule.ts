/**
 * 교보이지(kyowontour) 등록 파이프: 일정 표현층만 보정.
 * 누락 일차: 붙여넣기 본문의 `N일차` 블록으로만 보충 (LLM 행은 덮어쓰지 않음).
 * @see docs/register_schedule_expression_ssot.md
 */
import type { RegisterParsed, RegisterScheduleDay } from '@/lib/register-llm-schema-kyowontour'
import {
  normalizeKyowontourPasteForScheduleExtract,
  sliceKyowontourItineraryBodyForDayMarkers,
} from '@/lib/ybtour-paste-normalize-for-register-kyowontour'
import { stripCounselingTermsFromScheduleRow } from '@/lib/itinerary-counseling-terms-strip'
import {
  registerScheduleToDayInputs,
  type ItineraryDayInput,
} from '@/lib/upsert-itinerary-days-kyowontour'
import {
  deriveKyowontourScheduleDayHeaderTitle,
  shouldReplaceKyowontourScheduleDayTitle,
} from '@/lib/kyowontour-schedule-day-header-title'
import { buildEnglishPlaceTripartiteImageKeyword } from '@/lib/register-schedule-english-place-image-keyword'

const DAY_N_TRAVEL_RE = /^day\s*\d+\s*travel$/i

/** 줄 시작 `N일차` (끝 `\b`는 한글에서 불안정해 제외) */
const KYOWONTOUR_DAY_HEADER_LINE_RE = /^\s*(\d{1,2})\s*일차(?:\s|$)/i
/** 본문 전체 스캔: 줄 시작 또는 개행 직후 `N일차` */
const KYOWONTOUR_DAY_HEADER_GLOBAL_RE = /(?:^|\n)\s*(\d{1,2})\s*일차(?=\s*(?:\n|\r|$))/gi

function isPlaceholderHotel(ht: string): boolean {
  const t = ht.trim()
  return !t || t === '-' || t === '—' || t === '–'
}

function isNoiseLine(l: string): boolean {
  const t = l.trim()
  if (!t) return true
  if (t.length > 320) return true
  if (/^(더보기|크게 보기|Image|일정 전체|간략일정|여행 상세|일정표|호텔|선택관광|쇼핑정보|여행후기|logo-)/i.test(t)) return true
  if (/^(유의\s*[|ㅣ]|◎|■|▶|PC\(|모바일|https?:|작성 방법|▶이민국|\[선택관광|여행의 모든 일정은 유동적)/i.test(t)) return true
  if (/^개요\s*[:：]/.test(t)) return true
  if (/^(상품가|포함사항|불포함사항|총\s*상품가|약관\s*\/?|취소수수료|▣\s*)/.test(t)) return true
  if (/^(특별약관|국외여행\s*표준약관|예약금|계약금|환불규정|■\s*약관|■\s*취소|▣\s*예약)/.test(t)) return true
  if (/약관\s*\/\s*취소수수료/.test(t) && t.length < 100) return true
  if (/예약\s*후\s*\d{1,2}\s*시간\s*내.*예약금/.test(t)) return true
  return false
}

function isDateLine(l: string): boolean {
  return /^\d{4}[./]\d{2}[./]\d{2}/.test(l.trim())
}

function scanKyowontourAllDayHeaders(s: string): Array<{ day: number; headerStart: number; bodyStart: number }> {
  const matches: Array<{ day: number; headerStart: number; bodyStart: number }> = []
  let m: RegExpExecArray | null
  const re = new RegExp(KYOWONTOUR_DAY_HEADER_GLOBAL_RE.source, 'gi')
  while ((m = re.exec(s)) !== null) {
    const day = Number(m[1])
    if (!Number.isInteger(day) || day < 1 || day > 99) continue
    const headerStart = m.index
    const bodyStart = m.index + m[0].length
    matches.push({ day, headerStart, bodyStart })
  }
  return matches
}

/** 상세 일정 탭/섹션 라벨 이후만 스캔할 때 사용 (요약 일정표와 구분) */
function getKyowontourDetailSectionLabelEnd(s: string): number {
  const m = /(?:일차별\s*일정|여행\s*일정)/.exec(s)
  if (!m) return 0
  return m.index + m[0].length
}

/** 요약 표·탭 UI(날짜 없음)와 구분: 첫 일차 블록에 실제 일정 날짜 행이 있는지 */
function kyowontourFirstDayBlockLooksDetailed(s: string, bodyStart: number, nextHeaderStart: number): boolean {
  const head = s.slice(bodyStart, nextHeaderStart).slice(0, 900)
  if (/\d{4}[./]\d{2}[./]\d{2}/.test(head)) return true
  if (/\d{4}년\s*\d{1,2}월\s*\d{1,2}일/.test(head)) return true
  return false
}

/**
 * 첫 `1일차`는 문서 순서대로 보되,
 * - `일차별 일정` 라벨이 있으면 그 이후의 `1일차`만 후보로 두고,
 * - 그중 블록 상단에 날짜(YYYY.MM.DD 등)가 있는 **상세 일정**부터 체인을 시작한다.
 * (상단 요약 일정표·빈 탭 헤더 줄만 있는 1일차는 제외)
 */
function findFirstYbtourDay1MatchIndex(
  matches: Array<{ day: number; headerStart: number; bodyStart: number }>,
  s: string,
  minHeaderStart: number
): number {
  const candidates = matches
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.day === 1 && m.headerStart >= minHeaderStart)

  for (const { m, i } of candidates) {
    const nextHdr = matches.find((x) => x.headerStart > m.headerStart)
    const end = nextHdr ? nextHdr.headerStart : s.length
    if (kyowontourFirstDayBlockLooksDetailed(s, m.bodyStart, end)) return i
  }

  const legacy = matches.findIndex((x) => x.day === 1 && x.headerStart >= minHeaderStart)
  if (legacy >= 0) return legacy
  return matches.findIndex((x) => x.day === 1)
}

/** 본문에서 첫 번째 1일차부터 연속 증가하는 일차 헤더만 체인으로 삼음 (다음 상품·표의 재등장 1일차에서 중단) */
export function findYbtourAscendingDayHeaderChain(
  haystack: string
): Array<{ day: number; headerStart: number; bodyStart: number }> {
  const s = haystack.replace(/\r\n/g, '\n')
  const matches = scanKyowontourAllDayHeaders(s)
  const labelEnd = getKyowontourDetailSectionLabelEnd(s)
  const minHeaderStart = labelEnd > 0 ? labelEnd : 0
  const first1 = findFirstYbtourDay1MatchIndex(matches, s, minHeaderStart)
  if (first1 < 0) return []
  const chain: Array<{ day: number; headerStart: number; bodyStart: number }> = [matches[first1]!]
  for (let i = first1 + 1; i < matches.length; i++) {
    const prev = chain[chain.length - 1]!.day
    const cur = matches[i]!.day
    if (cur === prev + 1) chain.push(matches[i]!)
    else if (cur <= prev) break
    else break
  }
  return chain
}

function extractHotelFromYbtourBlock(block: string): string | null {
  const hotel = block.match(/예정호텔\s*[\n\r]+\s*([^\n\r]+)/i)?.[1]?.trim()
  if (hotel) return hotel.slice(0, 500)
  const suk = block.match(/숙박\s*[\n\r]+\s*([^\n\r]+)/i)?.[1]?.trim()
  if (suk && /호텔|Hotel|리조트|Resort/i.test(suk)) return suk.slice(0, 500)
  const line = block.match(/^\s*-\s*([^\n\r]+호텔[^\n\r]*)/im)?.[1]?.trim()
  return line ? line.slice(0, 500) : null
}

function extractMealsFromYbtourBlock(block: string): Partial<RegisterScheduleDay> {
  const mealSection = block.match(
    /식사\s*[\n\r]+([\s\S]*?)(?=\n\s*\d{1,2}일차(?:\s|$|\r?\n)|$)/i
  )?.[1]?.trim()
  const raw = mealSection ?? block.match(/식사\s*[\n\r]+\s*([^\n\r]+)/i)?.[1]?.trim()
  if (!raw) return {}
  let t = raw.replace(/\s+/g, ' ').replace(/일자\s*$/i, '').trim()
  const out: Partial<RegisterScheduleDay> = { mealSummaryText: t.slice(0, 500) }
  const bracketTriple = t.match(/\[조식\]\s*([^\[]*?)\s*\[중식\]\s*([^\[]*?)\s*\[석식\]\s*(.+)/i)
  if (bracketTriple) {
    out.breakfastText = bracketTriple[1]!.trim().slice(0, 200)
    out.lunchText = bracketTriple[2]!.trim().slice(0, 200)
    out.dinnerText = bracketTriple[3]!.trim().slice(0, 200)
    return out
  }
  const triple = t.match(
    /조식\s*[-–:]\s*([^,，]+)\s*[,，]\s*중식\s*[-–:]\s*([^,，]+)\s*[,，]\s*석식\s*[-–:]\s*(.+)/i
  )
  if (triple) {
    out.breakfastText = triple[1]!.trim().slice(0, 200)
    out.lunchText = triple[2]!.trim().slice(0, 200)
    out.dinnerText = triple[3]!.trim().slice(0, 200)
  }
  return out
}

/** 일차 표현층·붙여넣기 병합에서 imageKeyword 보강 시 사용 (교보이지 SSOT). */
export function keywordFromTitleDescription(title: string, description: string): string {
  return buildEnglishPlaceTripartiteImageKeyword({
    title,
    description,
    rawDayBody: '',
  }).slice(0, 180)
}

function extractYbtourDayDateIso(block: string): string | null {
  const dot = block.match(/(?:^|\n)\s*(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\s*(?:\([^)]*\))?/)
  if (dot) {
    return `${dot[1]}-${dot[2]!.padStart(2, '0')}-${dot[3]!.padStart(2, '0')}`
  }
  const kr = block.match(/(?:^|\n)\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/)
  if (kr) {
    return `${kr[1]}-${kr[2]!.padStart(2, '0')}-${kr[3]!.padStart(2, '0')}`
  }
  return null
}

/** 단일 일차 블록 → 표현층 최소 행 (본문에 있는 문구만) */
export function ybtourScheduleDayFromPastedBlock(day: number, block: string): RegisterScheduleDay {
  const dateText = extractYbtourDayDateIso(block)
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const useful: string[] = []
  for (const l of lines) {
    if (KYOWONTOUR_DAY_HEADER_LINE_RE.test(l)) continue
    if (isDateLine(l)) continue
    if (isNoiseLine(l)) continue
    useful.push(l)
  }

  const actLines = useful.filter(
    (l) =>
      /출발|도착|미팅|이동|투숙|조식 후|공항|관광|백두산|연길|인천|용정|두만강|셔틀|환승/i.test(l) &&
      l.length < 180
  )
  const description =
    actLines.length > 0
      ? [...new Set(actLines.map((x) => x.replace(/\s+/g, ' ')))].join(', ').slice(0, 400)
      : useful
          .filter((l) => l.length < 200)
          .slice(0, 5)
          .join(' ')
          .slice(0, 400)

  let title =
    useful.find(
      (l) => l.length >= 2 && l.length <= 36 && !/,/.test(l) && !/출발|도착|공항으로/.test(l)
    ) ?? useful[0] ?? `${day}일차`
  if (title.length > 80) title = title.slice(0, 80)

  const descFinal = (description || title).trim().slice(0, 400)
  if (shouldReplaceKyowontourScheduleDayTitle(title, descFinal)) {
    const derived = deriveKyowontourScheduleDayHeaderTitle({
      day,
      title: '',
      description: descFinal,
      dateText,
    }).trim()
    if (derived) title = derived.slice(0, 200)
  }
  const meals = extractMealsFromYbtourBlock(block)
  const hotelText = extractHotelFromYbtourBlock(block)

  return {
    day,
    title: title.trim().slice(0, 200),
    description: descFinal,
    imageKeyword: keywordFromTitleDescription(title, descFinal).slice(0, 180),
    dateText,
    hotelText,
    breakfastText: meals.breakfastText ?? null,
    lunchText: meals.lunchText ?? null,
    dinnerText: meals.dinnerText ?? null,
    mealSummaryText: meals.mealSummaryText ?? null,
  }
}

/** 붙여넣기 본문만으로 일차 행 후보 (연속 체인 전체; LLM 대체용 아님) */
export function buildYbtourScheduleFromPastedText(pastedBody: string): RegisterScheduleDay[] {
  const sliced = sliceKyowontourItineraryBodyForDayMarkers(pastedBody)
  const normalized = normalizeKyowontourPasteForScheduleExtract(sliced)
  const chain = findYbtourAscendingDayHeaderChain(normalized)
  if (!chain.length) return []
  const full = pastedBody.replace(/\r\n/g, '\n')
  const allHdr = scanKyowontourAllDayHeaders(full)
  const out: RegisterScheduleDay[] = []
  for (let i = 0; i < chain.length; i++) {
    const { day, bodyStart } = chain[i]!
    let end: number
    if (i + 1 < chain.length) {
      end = chain[i + 1]!.headerStart
    } else {
      const next = allHdr.find((h) => h.headerStart > bodyStart)
      end = next ? next.headerStart : full.length
    }
    const block = full.slice(bodyStart, end)
    out.push(ybtourScheduleDayFromPastedBlock(day, block))
  }
  return out
}

/** LLM `parsed.schedule`에 없는 day만 본문 보조 행으로 추가 후 day 오름차순 */
export function mergeMissingYbtourScheduleDays(
  parsed: RegisterParsed,
  pastedBody: string
): RegisterParsed {
  const bodyRows = buildYbtourScheduleFromPastedText(pastedBody)
  if (!bodyRows.length) return parsed

  const existing = parsed.schedule ?? []
  const byDay = new Map<number, RegisterScheduleDay>()
  for (const r of existing) {
    const d = Number(r.day)
    if (Number.isInteger(d) && d > 0) byDay.set(d, r)
  }
  for (const r of bodyRows) {
    if (!byDay.has(r.day)) byDay.set(r.day, r)
  }
  const merged = [...byDay.values()].sort((a, b) => a.day - b.day)
  return { ...parsed, schedule: merged }
}

/** 공용 기본 imageKeyword `Day N travel` 제거·대체 (title → description → 빈 문자열) */
export function sanitizeYbtourScheduleRowExpression(row: RegisterScheduleDay): RegisterScheduleDay {
  const kw = String(row.imageKeyword ?? '').trim()
  if (!DAY_N_TRAVEL_RE.test(kw)) return row
  const fromTitle = String(row.title ?? '').trim().slice(0, 120)
  const fromDesc = String(row.description ?? '').trim().slice(0, 120)
  const nextKw = fromTitle || fromDesc ? (fromTitle || fromDesc).slice(0, 120) : ''
  return { ...row, imageKeyword: nextKw }
}

export function augmentKyowontourScheduleExpressionParsed(
  parsed: RegisterParsed,
  pastedBodyText?: string | null
): RegisterParsed {
  let next = parsed
  if (pastedBodyText?.trim()) {
    next = mergeMissingYbtourScheduleDays(next, pastedBodyText)
  }
  const sched = next.schedule
  if (!sched?.length) return next
  const cleaned = sched.map((r) => sanitizeYbtourScheduleRowExpression(stripCounselingTermsFromScheduleRow(r)))
  return {
    ...next,
    schedule: cleaned.map((r) => {
      const title = String(r.title ?? '').trim()
      const description = String(r.description ?? '').trim()
      if (!shouldReplaceKyowontourScheduleDayTitle(title, description)) return r
      const nextTitle = deriveKyowontourScheduleDayHeaderTitle({
        day: r.day,
        title,
        description,
        dateText: r.dateText ?? undefined,
      }).trim()
      if (!nextTitle) return r
      return { ...r, title: nextTitle.slice(0, 200) }
    }),
  }
}

/**
 * `parsed.schedule`를 ItineraryDay 초안의 단일 소스로 삼고, hotelText가 있으면 accommodation을 맞춘다.
 * schedule이 비어 있으면 기존 drafts를 그대로 둔다.
 */
export function finalizeKyowontourItineraryDayDraftsFromSchedule(
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

/** confirm: 가격/항공만이 아니라 일정 표현층(일차 행 또는 실질 draft)이 있어야 함 */
export function kyowontourConfirmHasScheduleExpressionLayer(
  parsed: RegisterParsed,
  drafts: ItineraryDayInput[]
): boolean {
  if ((parsed.schedule?.length ?? 0) > 0) return true
  return drafts.some((d) => {
    const s = String(d.summaryTextRaw ?? '').trim()
    if (s.length >= 8) return true
    const ht = d.hotelText?.trim()
    if (ht && !isPlaceholderHotel(ht)) return true
    const m = String(d.meals ?? '').trim()
    if (m.length > 0) return true
    return false
  })
}
