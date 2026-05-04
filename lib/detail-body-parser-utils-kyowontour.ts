/**
 * 교보이지(kyowontour) 등록 detail-body: 정규화·앵커·섹션 분리·슬라이스.
 *
 * `flight_section` / `optional_tour_section` / `shopping_section` 앵커는 **일정·호텔·포함불포함과의 경계**를 잡기 위한 것이며,
 * 이 축의 **표·항공 구조화**는 하지 않는다(SSOT: `register-input-parse-kyowontour` + 정형 입력란).
 *
 * @see docs/body-parser-ybtour-ssot.md — 교보이지(kyowontour)는 동일 SSOT 규약.
 *
 * 상위 정책: `docs/admin-register-supplier-precise-spec.md` §4.
 */
import type { DetailSectionType, IncludedExcludedStructured } from '@/lib/detail-body-parser-types'

export type DetailSectionSlices = {
  flightSection: string
  hotelSection: string
  optionalSection: string
  shoppingSection: string
  incExcSection: string
}

/** 교보이지 상세 본문·일정 블록 상단 정렬에 맞춘 앵커 */
const KYOWONTOUR_SECTION_ANCHOR_ALIASES: Record<DetailSectionType, string[]> = {
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
    '교보이지',
    '옐로우',
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
    '여행 일정',
    '여행일정표',
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
    '노랑 선택관광',
  ],
  shopping_section: [
    '쇼핑',
    '쇼핑정보',
    '쇼핑안내',
    '쇼핑센터',
    '쇼핑횟수',
    '쇼핑 횟수',
    '쇼핑 코스',
  ],
  included_excluded_section: [
    '포함사항',
    '불포함사항',
    '포함 사항',
    '불포함 사항',
    '포함 / 불포함',
    '포함/불포함',
    '포함내역',
    '불포함내역',
  ],
  notice_section: [
    '포함/불포함/약관',
    '약관 / 취소수수료',
    '약관/취소수수료',
    '■ 약관',
    '■ 취소수수료',
    '유의사항',
    '여행 중 유의사항',
    '여행 시 유의사항',
    '예약 시 유의사항',
    '약관',
  ],
}

function buildKyowontourAnchorStarters(): Array<{ type: DetailSectionType; re: RegExp }> {
  return (Object.keys(KYOWONTOUR_SECTION_ANCHOR_ALIASES) as DetailSectionType[]).map((type) => ({
    type,
    re: new RegExp(
      `(${KYOWONTOUR_SECTION_ANCHOR_ALIASES[type]
        .slice()
        .sort((a, b) => b.length - a.length)
        .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|')})`,
      'i'
    ),
  }))
}

const KYOWONTOUR_STARTERS = buildKyowontourAnchorStarters()

function isFalseShoppingAnchorLineKyowontour(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (/(면세\s*점|면세점).*쇼핑|(?:^|[■*·])\s*[^\n]*쇼핑\s*\d+\s*회/.test(t) && !/^쇼핑(?:정보|안내|센터)/i.test(t))
    return true
  return /(쇼핑항목|쇼핑장소|쇼핑\s*품목|쇼핑샵명)/i.test(line) && !/^쇼핑정보/i.test(t)
}

function isFalseHotelAnchorLineKyowontour(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (/예정호텔[은는이가이며]\b/i.test(t)) return true
  if (/(?:일급|동급|특급|[0-9]\s*성)\s*호텔\b/i.test(t)) return true
  if (/숙박시설/i.test(t)) return true
  return false
}

function splitKyowontourSectionsByAnchors(normalized: string): Array<{ type: DetailSectionType; text: string }> {
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
    const hit = KYOWONTOUR_STARTERS.find((s) => {
      const t = line.trim()
      if (s.type === 'hotel_section') {
        if (/^호텔$/i.test(t)) return true
        if (!s.re.test(line)) return false
        if (isFalseHotelAnchorLineKyowontour(line)) return false
        return true
      }
      if (!s.re.test(line)) return false
      if (s.type === 'shopping_section' && isFalseShoppingAnchorLineKyowontour(line)) return false
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

/** 항공 시드: flight 블록(join) → schedule → summary 순으로 이어 붙임. 하한 72. (일정이 요약보다 앞선 붙여넣기를 가정 — ybtour SSOT 문서의 항공 시드 슬라이스와 동일.) */
const KYOWONTOUR_FLIGHT_SEED_MIN_LEN = 72

export function sliceDetailBodySections(
  normalizedRaw: string,
  sections: Array<{ type: DetailSectionType; text: string }>,
  paste: { hotelRaw?: string | null; optionalRaw?: string | null; shoppingRaw?: string | null }
): DetailSectionSlices {
  const pick = (t: DetailSectionType) => sections.find((s) => s.type === t)?.text ?? ''
  const joinSections = (t: DetailSectionType) =>
    sections.filter((s) => s.type === t).map((s) => s.text).filter(Boolean).join('\n')
  const flightSectionSeed = [pick('summary_section'), joinSections('flight_section'), pick('schedule_section')]
    .filter(Boolean)
    .join('\n')
  const flightSection =
    flightSectionSeed.length < KYOWONTOUR_FLIGHT_SEED_MIN_LEN ? normalizedRaw : flightSectionSeed
  return {
    flightSection,
    hotelSection: paste.hotelRaw?.trim() || joinSections('hotel_section'),
    optionalSection: paste.optionalRaw?.trim() || joinSections('optional_tour_section'),
    shoppingSection: paste.shoppingRaw?.trim() || joinSections('shopping_section'),
    incExcSection: joinSections('included_excluded_section'),
  }
}

function cleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim()
}

export function normalizeDetailRawText(raw: string): string {
  /** 줄 전체가 UI 잔재일 때만 제거(본문 중간 '여행후기' 문장 보존). */
  const dropLine = (t: string) =>
    /^(더보기|크게보기|후기|리뷰|좋아요|공유|배너|이벤트|버튼|[-_=]{3,}|교보이지\s*고객|옐로우\s*볼)$/i.test(
      t.replace(/\s+/g, ' ').trim()
    )
  return raw
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\t/g, ' ').trim())
    .filter((l) => l && !dropLine(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

export function splitDetailSections(normalized: string): Array<{ type: DetailSectionType; text: string }> {
  return splitKyowontourSectionsByAnchors(normalized)
}

/** 레거시·비등록 용도. 관리자 등록 SSOT는 `detail-body-parser-kyowontour`의 전용 포함/불포함 파서를 쓴다. */
export function parseIncludedExcludedSection(section: string): IncludedExcludedStructured {
  const lines = section.split('\n').map(cleanLine).filter(Boolean)
  const includedItems = lines.filter((l) => /(포함|included)/i.test(l)).slice(0, 30)
  const excludedItems = lines.filter((l) => /(불포함|excluded|별도|현지\s*경비)/i.test(l)).slice(0, 30)
  return {
    includedItems,
    excludedItems,
    noteText: lines.filter((l) => !/(포함|불포함|included|excluded)/i.test(l)).slice(0, 10).join('\n'),
    reviewNeeded: includedItems.length === 0 && excludedItems.length === 0 && section.trim().length > 0,
    reviewReasons:
      includedItems.length === 0 && excludedItems.length === 0 && section.trim().length > 0 ? ['포함/불포함 분리 실패'] : [],
  }
}
