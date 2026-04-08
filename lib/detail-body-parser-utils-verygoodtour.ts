/**
 * 참좋은여행 등록 detail-body: 정규화·앵커·섹션 분리·슬라이스.
 *
 * 항공/옵션/쇼핑 앵커는 **경계**용. **구조화**는 `register-input-parse-verygoodtour` + 정형 입력란.
 *
 * @see docs/body-parser-verygoodtour-ssot.md
 *
 * 상위 정책: `docs/admin-register-supplier-precise-spec.md`.
 */
import type { DetailSectionType, IncludedExcludedStructured } from '@/lib/detail-body-parser-types'

export type DetailSectionSlices = {
  flightSection: string
  hotelSection: string
  optionalSection: string
  shoppingSection: string
  incExcSection: string
}

/** 참좋은 붙여넣기(O포함 블록, 괄호형 항공 헤더 등)에 맞춘 앵커 */
const VERYGOOD_SECTION_ANCHOR_ALIASES: Record<DetailSectionType, string[]> = {
  summary_section: [
    '여행핵심정보',
    '상품 핵심정보',
    '여행 주요일정',
    '요약설명',
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
    '참좋은',
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
    '현지 선택관광',
  ],
  /** 본문 중간 `…/쇼핑안내` 오탐 방지 — 행 시작 헤더만 매칭(`buildVerygoodAnchorStarters`) */
  shopping_section: ['쇼핑정보', '쇼핑안내', '쇼핑센터', '쇼핑횟수', '쇼핑 횟수', '쇼핑 총', '쇼핑총'],
  included_excluded_section: [
    '포함사항',
    '불포함사항',
    'O포함사항',
    'O 포함사항',
    'O불포함사항',
    'O 불포함사항',
    '포함 / 불포함',
    '포함/불포함',
    '포함내역',
    '불포함내역',
  ],
  notice_section: [
    '여행일정 변경에 관한 사전 동의 안내',
    '여행일정 변경에 관한 사전 동의',
    '여행일정 변경에 관한',
    '상품평점',
    '유의사항',
    '참고사항',
    '여행 중 유의사항',
    '여행 시 유의사항',
    '예약 시 유의사항',
    '약관',
  ],
}

/**
 * 쇼핑: 행 시작만 — 탭줄 `…/쇼핑안내` 오탐 방지.
 * 포함/불포함: 행 시작만 — 본문 `…불포함` 같은 단어가 `포함|불포함` 서브스트링 앵커로 오분할되지 않게 함.
 * 옵션은 `□ 선택관광` 등 행두부 변형 허용 위해 전역 매칭 유지.
 */
const VERYGOOD_LINE_START_ANCHOR_TYPES: ReadonlySet<DetailSectionType> = new Set([
  'shopping_section',
  'included_excluded_section',
  /** `※ 참고사항 -> …` 표 안내가 `참고사항` 서브스트링으로 notice로 오분할되는 것 방지 */
  'notice_section',
])

function buildVerygoodAnchorStarters(): Array<{ type: DetailSectionType; re: RegExp }> {
  return (Object.keys(VERYGOOD_SECTION_ANCHOR_ALIASES) as DetailSectionType[]).map((type) => {
    const aliases = VERYGOOD_SECTION_ANCHOR_ALIASES[type]
      .slice()
      .sort((a, b) => b.length - a.length)
      .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')
    const re = VERYGOOD_LINE_START_ANCHOR_TYPES.has(type)
      ? new RegExp(`^\\s*(?:${aliases})`, 'i')
      : new RegExp(`(${aliases})`, 'i')
    return { type, re }
  })
}

const VERYGOOD_STARTERS = buildVerygoodAnchorStarters()

function isFalseShoppingAnchorLineVerygood(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (/(면세\s*점|면세점).*쇼핑|쇼핑\s*\d+\s*회/.test(t) && !/^쇼핑(?:정보|안내|센터)/i.test(t)) return true
  if (/(일정표|관광지약관|유의사항|참고사항|선택관광).{0,40}쇼핑/i.test(t)) return true
  return /(쇼핑항목|쇼핑장소|쇼핑\s*품목|쇼핑샵명)/i.test(line) && !/^쇼핑정보/i.test(t)
}

function isFalseOptionalAnchorLineVerygood(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (/(일정표|관광지약관|유의사항|참고사항).{0,40}선택관광/i.test(t)) return true
  if (/(선택관광|쇼핑)\s*안내\s*$/i.test(t) && t.length > 40) return true
  return false
}

function isFalseHotelAnchorLineVerygood(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (/예정호텔[은는이가이며]\b/i.test(t)) return true
  if (/(?:일급|동급|특급|[0-9]\s*성)\s*호텔\b/i.test(t)) return true
  if (/숙박시설/i.test(t)) return true
  return false
}

/**
 * `항공` 전역 앵커가 `1. 왕복항공권…` 같은 포함/불포함 표 행에서 오매칭되는 것을 막는다.
 * 실제 항공 블록 헤더(`■ 항공`, `항공여정` 등)는 제외하지 않는다.
 */
function isFalseFlightAnchorLineVerygood(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (/^■\s*항공\b/i.test(t)) return false
  if (/^▲\s*항공\b/i.test(t)) return false
  if (/^항공\s*(여정|정보|편명|사|스케줄)\b/i.test(t)) return false
  if (/^항공여정\b/i.test(t)) return false
  if (/^출국\s*$/i.test(t) || /^입국\s*$/i.test(t)) return false
  if (/^\d+[.)]\s+/.test(t) && /왕복항공권|항공권\s*및|제세공과금|유류할증료|일정상\s*표기|호텔\s*숙박|최고\s*1억|여행자보험|해외여행자보험|관광지\s*입장/i.test(t)) {
    return true
  }
  if (line.includes('\t')) {
    const parts = line.split('\t').map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2 && /^\d+[.)]/.test(parts[0]!) && /^\d+[.)]/.test(parts[1]!)) return true
  }
  return false
}

function splitVerygoodSectionsByAnchors(normalized: string): Array<{ type: DetailSectionType; text: string }> {
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
    const hit = VERYGOOD_STARTERS.find((s) => {
      const t = line.trim()
      if (s.type === 'hotel_section') {
        if (/^호텔$/i.test(t)) return true
        if (!s.re.test(line)) return false
        if (isFalseHotelAnchorLineVerygood(line)) return false
        return true
      }
      if (s.type === 'flight_section' && isFalseFlightAnchorLineVerygood(line)) return false
      if (!s.re.test(line)) return false
      if (s.type === 'shopping_section' && isFalseShoppingAnchorLineVerygood(line)) return false
      if (s.type === 'optional_tour_section' && isFalseOptionalAnchorLineVerygood(line)) return false
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

/** 참좋은은 상단 요약이 긴 경우가 있어 요약→일정 순으로 시드에 반영한다. */
const VERYGOOD_FLIGHT_SEED_MIN_LEN = 88

export function sliceDetailBodySections(
  normalizedRaw: string,
  sections: Array<{ type: DetailSectionType; text: string }>,
  paste: { hotelRaw?: string | null; optionalRaw?: string | null; shoppingRaw?: string | null }
): DetailSectionSlices {
  const pick = (t: DetailSectionType) => sections.find((s) => s.type === t)?.text ?? ''
  const joinSections = (t: DetailSectionType) =>
    sections.filter((s) => s.type === t).map((s) => s.text).filter(Boolean).join('\n')
  const flightSectionSeed = [joinSections('flight_section'), pick('summary_section'), pick('schedule_section')]
    .filter(Boolean)
    .join('\n')
  let flightSection =
    flightSectionSeed.length < VERYGOOD_FLIGHT_SEED_MIN_LEN ? normalizedRaw : flightSectionSeed
  /** 섹션 합성이 길어도 `출국`/`입국` 앵커가 빠지면 항공 파서가 실패하므로 전체 본문으로 폴백 */
  const hasFlightAnchors = (s: string) =>
    /(^|\n)출국\s*(?:\n|$)/m.test(s) && /(^|\n)입국\s*(?:\n|$)/m.test(s)
  if (!hasFlightAnchors(flightSection)) {
    flightSection = normalizedRaw
  }
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

function isVerygoodUiNoiseLine(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (/^바로가기$/i.test(t)) return true
  if (/^평점$/i.test(t)) return true
  if (/^여행후기$/i.test(t)) return true
  if (/^상세보기$/i.test(t)) return true
  if (/^지도보기$/i.test(t)) return true
  if (/^내용보기$/i.test(t)) return true
  if (/^내용\s*전체\s*열기$/i.test(t)) return true
  if (/^상품평점$/i.test(t) || /^상품평점\s+/i.test(t)) return true
  if (/총\s*\d+\s*개의\s*상품평/i.test(t)) return true
  if (/실제\s*여행객\s*\d+\s*명의\s*리뷰/i.test(t)) return true
  if (/^연령대별\s*선호도$/i.test(t)) return true
  if (/^솔직한\s*여행이야기$/i.test(t)) return true
  if (/^\d{1,3}%$/.test(t)) return true
  if (/^20대$|^30대$|^40대$|^50대$/i.test(t)) return true
  return false
}

export function normalizeDetailRawText(raw: string): string {
  /** 줄 **내부**의 '후기'까지 지우면 일정/포함문이 손상됨 — 전역 `후기` 제거 금지 */
  const drop =
    /(더보기|크게보기|좋아요|공유|배너|이벤트|버튼|^[-_=]{3,}$|참좋은\s*여행|챔조아)/i
  return raw
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !drop.test(l) && !isVerygoodUiNoiseLine(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

export function splitDetailSections(normalized: string): Array<{ type: DetailSectionType; text: string }> {
  return splitVerygoodSectionsByAnchors(normalized)
}

/** 일정 슬라이스에서 법무 동의·탭 잔재를 제거(앵커 누락 시 대비). SSOT: `docs/body-parser-verygoodtour-ssot.md`. */
function thinVerygoodScheduleLegalNoise(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let skip = false
  for (const line of lines) {
    const t = line.replace(/\s+/g, ' ').trim()
    if (/여행일정\s*변경에\s*관한\s*사전\s*동의/i.test(t)) {
      skip = true
      continue
    }
    if (skip) {
      if (/^\d+\s*일차\b/u.test(t) || /^DAY\s*\d+/i.test(t) || /^■\s*항공\b/i.test(t)) {
        skip = false
        if (!/여행일정\s*변경에\s*관한/i.test(t)) out.push(line)
      }
      continue
    }
    out.push(line)
  }
  return out.join('\n').trim()
}

export function postProcessVerygoodSplitSections(
  sections: Array<{ type: DetailSectionType; text: string }>
): Array<{ type: DetailSectionType; text: string }> {
  return sections.map((s) =>
    s.type === 'schedule_section' ? { ...s, text: thinVerygoodScheduleLegalNoise(s.text) } : s
  )
}

/** 레거시·비등록 용도. 관리자 등록 SSOT는 `detail-body-parser-verygoodtour`의 전용 포함/불포함 파서를 쓴다. */
export function parseIncludedExcludedSection(section: string): IncludedExcludedStructured {
  const lines = section.split('\n').map(cleanLine).filter(Boolean)
  const includedItems = lines.filter((l) => /(포함|included|O\s*포함)/i.test(l)).slice(0, 30)
  const excludedItems = lines.filter((l) => /(불포함|excluded|별도|O\s*불포함)/i.test(l)).slice(0, 30)
  return {
    includedItems,
    excludedItems,
    noteText: lines.filter((l) => !/(포함|불포함|included|excluded)/i.test(l)).slice(0, 10).join('\n'),
    reviewNeeded: includedItems.length === 0 && excludedItems.length === 0 && section.trim().length > 0,
    reviewReasons:
      includedItems.length === 0 && excludedItems.length === 0 && section.trim().length > 0 ? ['포함/불포함 분리 실패'] : [],
  }
}
