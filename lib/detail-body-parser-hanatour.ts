/**
 * 하나투어(hanatour) 관리자 등록 — **본문 축** 스냅샷.
 *
 * 한 모듈에 모은 책임:
 * - 정규화·섹션 앵커·슬라이스·일정 원료(`schedule_section`) thinning
 * - `parseDetailBodyStructuredHanatour`: 스냅샷 조립(호텔 표, 포함/불포함 트리플, `raw.hanatourReservationStatus`)
 * - 일차 배열 `schedule`는 만들지 않음(표현층·LLM·`parse-and-register-hanatour-schedule` 축).
 *
 * **비담당:** 항공·옵션·쇼핑 **구조화** — `register-input-parse-hanatour` + `register-parse-hanatour` 정형칸.
 *
 * @see docs/body-parser-hanatour-ssot.md
 *
 * 상위 규약: `docs/admin-register-supplier-precise-spec.md` §3. 일정 표현: `docs/register_schedule_expression_ssot.md`.
 */
import type {
  DetailBodyParseSnapshot,
  DetailSectionType,
  HanatourReservationStatusParsed,
} from '@/lib/detail-body-parser-types'
import {
  emptyFlightStructured,
  emptyOptionalToursStructured,
  emptyShoppingStructured,
} from '@/lib/detail-body-parser-input-axis-stubs'
import { parseHanatourIncludedExcludedStructured } from '@/lib/hanatour-basic-info-body-extract'
import { parseHotelSectionHanatour } from '@/lib/hotel-parser-hanatour'
import { buildDetailReviewPolicyHanatour } from '@/lib/review-policy-hanatour'

// --- 정규화·앵커·슬라이스 (구 `detail-body-parser-utils-hanatour.ts`) ---

/**
 * `raw.hanatourReservationStatus` 문자열 파트 → 출발조건 숫자 (본문 한 줄 SSOT).
 * `extractMinimumDepartureMeta`와 동일 의미로 맞춘다.
 */
export function numericFieldsFromHanatourReservationStatusParsed(
  parsed: HanatourReservationStatusParsed | null | undefined
): {
  currentBookedCount: number | null
  remainingSeatsCount: number | null
  minimumDepartureCount: number | null
} | null {
  if (!parsed) return null
  const pickInt = (s: string | null | undefined, re: RegExp): number | null => {
    if (!s?.trim()) return null
    const m = s.trim().match(re)
    if (m?.[1] == null) return null
    const n = parseInt(m[1], 10)
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  const booked = pickInt(parsed.bookedPart, /^(\d+)/)
  const seats =
    pickInt(parsed.seatsPart, /^(\d+)\s*석/i) ??
    pickInt(parsed.seatsPart, /^(\d+)/)
  const minFrom =
    pickInt(parsed.minDeparturePart, /성인\s*(\d+)\s*명/i) ??
    pickInt(parsed.minDeparturePart, /(\d+)\s*명/) ??
    pickInt(parsed.minDeparturePart, /^(\d+)/)
  if (booked == null && seats == null && minFrom == null) return null
  return {
    currentBookedCount: booked,
    remainingSeatsCount: seats,
    minimumDepartureCount: minFrom,
  }
}

export type DetailSectionSlices = {
  flightSection: string
  hotelSection: string
  optionalSection: string
  shoppingSection: string
  incExcSection: string
}

/** SSOT: 섹션 앵커 별칭(다른 공급사와 별도 유지). */
export const HANATOUR_SECTION_ANCHOR_ALIASES: Record<DetailSectionType, string[]> = {
  summary_section: [
    '여행핵심정보',
    '상품 핵심정보',
    '여행 주요일정',
    '요약정보',
    '여행기간',
    '상품가격',
    '여행상품 핵심정보',
    '상품소개',
    '핵심포인트',
    '상품 안내',
    '상품안내',
    '여행도시',
    '출발인원',
    '상품특전',
    '하나투어',
    '상품 개요',
  ],
  flight_section: [
    '항공여정',
    '출국',
    '입국',
    '항공사',
    '편명',
    '교통',
    '항공',
    '항공편',
    '항공정보',
    '총 소요시간',
    '도착예정시간',
  ],
  schedule_section: [
    '일정표',
    '상세일정',
    '간략일정',
    '여행일정',
    '1일차',
    '2일차',
    '3일차',
    '4일차',
    'DAY 1',
    'DAY 2',
  ],
  hotel_section: [
    '예정호텔',
    '숙박정보',
    '숙박 안내',
    '숙소',
    '호텔정보',
    '호텔&관광정보',
    '호텔/숙소',
    '투숙호텔',
  ],
  optional_tour_section: [
    '선택관광',
    '현지옵션',
    '선택옵션',
    '선택관광 안내',
    '선택관광안내',
    '선택경비',
    '옵션투어',
    '옵션관광',
  ],
  shopping_section: [
    '쇼핑',
    '쇼핑정보',
    '쇼핑안내',
    '쇼핑센터',
    '쇼핑횟수',
    '쇼핑 횟수',
  ],
  included_excluded_section: [
    '포함/불포함/선택경비 정보',
    '포함사항',
    '불포함사항',
    '포함 / 불포함',
    '포함/불포함',
    '포함내역',
    '불포함내역',
    '포함',
    '불포함',
  ],
  notice_section: ['유의사항', '참고사항', '여행 중 유의사항', '여행 시 유의사항', '예약 시 유의사항', '약관'],
}

function buildHanatourAnchorStarters(): Array<{ type: DetailSectionType; re: RegExp }> {
  return (Object.keys(HANATOUR_SECTION_ANCHOR_ALIASES) as DetailSectionType[]).map((type) => ({
    type,
    re: new RegExp(
      `(${HANATOUR_SECTION_ANCHOR_ALIASES[type]
        .slice()
        .sort((a, b) => b.length - a.length)
        .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|')})`,
      'i'
    ),
  }))
}

const HANATOUR_STARTERS = buildHanatourAnchorStarters()

function isFalseShoppingAnchorLineHanatour(line: string): boolean {
  return /(쇼핑항목|쇼핑장소|쇼핑\s*품목|쇼핑샵명)/i.test(line) && !/^쇼핑정보/i.test(line.trim())
}

function isFalseHotelAnchorLineHanatour(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (/예정호텔[은는이가이며]\b/i.test(t)) return true
  if (/(?:일급|동급|특급|[0-9]\s*성)\s*호텔\b/i.test(t)) return true
  if (/숙박시설/i.test(t)) return true
  return false
}

function splitHanatourSectionsByAnchors(normalized: string): Array<{ type: DetailSectionType; text: string }> {
  const lines = normalized.split('\n')
  const out: Array<{ type: DetailSectionType; text: string }> = []
  let cur: DetailSectionType = 'summary_section'
  let buf: string[] = []
  const flush = () => {
    const text = buf.join('\n').trim()
    if (text) out.push({ type: cur, text })
    buf = []
  }
  for (const line of lines) {
    const hit = HANATOUR_STARTERS.find((s) => {
      const t = line.trim()
      if (s.type === 'hotel_section') {
        if (/^호텔$/i.test(t)) return true
        if (!s.re.test(line)) return false
        if (isFalseHotelAnchorLineHanatour(line)) return false
        return true
      }
      if (!s.re.test(line)) return false
      if (s.type === 'shopping_section' && isFalseShoppingAnchorLineHanatour(line)) return false
      return true
    })
    if (hit && buf.length > 0) {
      flush()
      cur = hit.type
    } else if (hit && buf.length === 0) {
      cur = hit.type
    }
    buf.push(line)
  }
  flush()
  return out
}

/** 항공 시드가 이 길이 미만이면 전체 본문을 항공 입력으로 넘긴다(하나투어 기본 80자). */
const HANATOUR_FLIGHT_SEED_MIN_LEN = 80

export function sliceDetailBodySections(
  normalizedRaw: string,
  sections: Array<{ type: DetailSectionType; text: string }>,
  paste: { hotelRaw?: string | null; optionalRaw?: string | null; shoppingRaw?: string | null }
): DetailSectionSlices {
  const pick = (t: DetailSectionType) => sections.find((s) => s.type === t)?.text ?? ''
  const joinSections = (t: DetailSectionType) =>
    sections.filter((s) => s.type === t).map((s) => s.text).filter(Boolean).join('\n')
  const flightSectionSeed = [joinSections('flight_section'), pick('schedule_section'), pick('summary_section')]
    .filter(Boolean)
    .join('\n')
  const flightSection =
    flightSectionSeed.length < HANATOUR_FLIGHT_SEED_MIN_LEN ? normalizedRaw : flightSectionSeed
  return {
    flightSection,
    hotelSection: paste.hotelRaw?.trim() || joinSections('hotel_section'),
    optionalSection: paste.optionalRaw?.trim() || joinSections('optional_tour_section'),
    shoppingSection: paste.shoppingRaw?.trim() || joinSections('shopping_section'),
    incExcSection: joinSections('included_excluded_section'),
  }
}

function isHanatourScheduleUiNoiseLine(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (/^상세보기$/i.test(t)) return true
  if (/^내용보기$/i.test(t)) return true
  if (/^지도보기$/i.test(t)) return true
  if (/^일정\s*전체펼침$/i.test(t)) return true
  if (/^일정\s*전체닫힘$/i.test(t)) return true
  if (/^이전다음$/i.test(t)) return true
  if (/^\d+\s*\/\s*\d+$/i.test(t)) return true
  return false
}

export function normalizeDetailRawText(raw: string): string {
  const drop =
    /(더보기|크게보기|후기|리뷰|좋아요|공유|배너|이벤트|버튼|^[-_=]{3,}$|하나투어\s*고객센터|대표번호\s*\d)/i
  return raw
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\t/g, ' ').trim())
    .filter((l) => l && !drop.test(l) && !isHanatourScheduleUiNoiseLine(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

export function splitDetailSections(normalized: string): Array<{ type: DetailSectionType; text: string }> {
  return splitHanatourSectionsByAnchors(normalized)
}

/** `예약 : … 좌석 : … (최소출발 : …)` 한 줄 추출 — 본문 상단·여행도시 줄에 붙은 형태 포함. */
export function extractHanatourReservationStatusFromNormalized(
  normalized: string
): HanatourReservationStatusParsed | null {
  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.replace(/\s+/g, ' ').trim()
    if (!line || !/예약\s*:/i.test(line) || !/좌석\s*:/i.test(line)) continue
    const bookedMatch = line.match(/예약\s*:\s*(.+?)\s*좌석\s*:/i)
    const seatsMatch = line.match(/좌석\s*:\s*([^(]+?)(?:\(\s*최소\s*출발\s*:|$)/i)
    const minMatch = line.match(/\(\s*최소\s*출발\s*:\s*([^)]+)\)/i)
    return {
      sourceLine: rawLine.trim(),
      bookedPart: bookedMatch?.[1]?.replace(/\s+/g, ' ').trim() ?? null,
      seatsPart: seatsMatch?.[1]?.replace(/\s+/g, ' ').trim() ?? null,
      minDeparturePart: minMatch?.[1]?.replace(/\s+/g, ' ').trim() ?? null,
    }
  }
  return null
}

function thinHanatourScheduleBlob(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let skipBrochure = false
  for (const raw of lines) {
    const t = raw.replace(/\s+/g, ' ').trim()
    if (/^개요\s*[:：]/i.test(t)) {
      skipBrochure = true
      continue
    }
    if (skipBrochure) {
      if (
        t.length > 0 &&
        t.length < 100 &&
        /(\d+\s*일차|출발|도착|이동|식사|조식|중식|석식|호텔|미팅|관광|편명|DAY\s*\d)/i.test(t)
      ) {
        skipBrochure = false
        out.push(raw)
      }
      continue
    }
    if (/^상세보기$/i.test(t) || /^Visit\s+Japan/i.test(t)) continue
    if (/호텔\s*총\s*\d+\s*개의\s*예정\s*호텔/i.test(t)) {
      skipBrochure = true
      continue
    }
    if (/^객실타입\s*[:：]|^온천시설\s*[:：]|^편의시설\s*[:：]|^기타정보\s*[:：]/i.test(t)) continue
    if (/^일본\s*(입국|방문객)\s*(규정|절차|준비)/i.test(t) && t.length < 48) {
      skipBrochure = true
      continue
    }
    if (t.length > 320 && !/^\d+\s*일차/u.test(t) && !/^(조식|중식|석식|호텔)/i.test(t)) continue
    out.push(raw)
  }
  return out.join('\n').trim()
}

export function thinHanatourSplitScheduleSections(
  sections: Array<{ type: DetailSectionType; text: string }>
): Array<{ type: DetailSectionType; text: string }> {
  return sections.map((s) =>
    s.type === 'schedule_section' ? { ...s, text: thinHanatourScheduleBlob(s.text) } : s
  )
}

// --- 스냅샷 조립 ---

export function parseDetailBodyStructuredHanatour(input: {
  rawText: string
  hotelRaw?: string | null
  optionalRaw?: string | null
  shoppingRaw?: string | null
}): DetailBodyParseSnapshot {
  const normalizedRaw = normalizeDetailRawText(input.rawText)
  const sections = thinHanatourSplitScheduleSections(splitDetailSections(normalizedRaw))
  const hanatourReservationStatus = extractHanatourReservationStatusFromNormalized(normalizedRaw)
  const { flightSection, hotelSection, optionalSection, shoppingSection, incExcSection } =
    sliceDetailBodySections(normalizedRaw, sections, {
      hotelRaw: input.hotelRaw,
      optionalRaw: input.optionalRaw,
      shoppingRaw: input.shoppingRaw,
    })

  const flightStructured = emptyFlightStructured()
  const hotelStructured = parseHotelSectionHanatour(hotelSection)
  const optionalToursStructured = emptyOptionalToursStructured()
  const shoppingStructured = emptyShoppingStructured()
  const includedExcludedStructured = parseHanatourIncludedExcludedStructured(incExcSection, normalizedRaw)

  const { review, sectionReview, qualityScores, failurePatterns } = buildDetailReviewPolicyHanatour({
    sections,
    flightStructured,
    hotelStructured,
    optionalToursStructured,
    shoppingStructured,
    includedExcludedStructured,
    optionalPasteRaw: input.optionalRaw?.trim() || null,
    shoppingPasteRaw: input.shoppingRaw?.trim() || null,
  })

  return {
    normalizedRaw,
    sections,
    review,
    sectionReview,
    qualityScores,
    failurePatterns,
    flightStructured,
    hotelStructured,
    optionalToursStructured,
    shoppingStructured,
    includedExcludedStructured,
    brandKey: 'hanatour',
    raw: {
      hotelPasteRaw: input.hotelRaw?.trim() || null,
      optionalToursPasteRaw: input.optionalRaw?.trim() || null,
      shoppingPasteRaw: input.shoppingRaw?.trim() || null,
      flightRaw: flightSection.trim() || null,
      hanatourReservationStatus,
    },
  }
}
