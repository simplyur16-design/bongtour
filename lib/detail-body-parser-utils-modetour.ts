/**
 * 모두투어 등록 detail-body: 정규화·앵커·섹션 분리·슬라이스.
 *
 * 항공/옵션/쇼핑 앵커는 **경계**만 잡는다. **구조화**는 `register-input-parse-modetour` + 정형 입력란.
 *
 * @see docs/body-parser-modetour-ssot.md
 *
 * 상위 정책: `docs/admin-register-supplier-precise-spec.md`. 항공/가격 공개: `docs/ops/modetour-parse-contract.md`.
 */
import type { DetailSectionType, IncludedExcludedStructured } from '@/lib/detail-body-parser-types'

export type DetailSectionSlices = {
  flightSection: string
  hotelSection: string
  optionalSection: string
  shoppingSection: string
  incExcSection: string
}

/** 모두투어 상세 붙여넣기 기준 앵커(표·항공 블록 형태에 맞춤, 타 공급사와 별도) */
const MODETOUR_SECTION_ANCHOR_ALIASES: Record<DetailSectionType, string[]> = {
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
    '모두투어',
    '상품요약',
    '대표 일정',
  ],
  flight_section: [
    '항공여정',
    '출국',
    '입국',
    '항공사',
    '편명',
    '교통',
    '교통편',
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
    'DAY1',
    'DAY2',
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
    '모두투어 옵션',
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
    '포함/불포함 사항',
    '포함 사항',
    '불포함 사항',
    '포함사항',
    '불포함사항',
    '포함 / 불포함',
    '포함/불포함',
    '포함내역',
    '불포함내역',
    '포함',
    '불포함',
  ],
  notice_section: [
    '여행 상세 정보',
    '유의사항',
    '참고사항',
    '여행 중 유의사항',
    '여행 시 유의사항',
    '예약 시 유의사항',
    '미팅정보',
    '약관',
  ],
}

function buildModetourAnchorStarters(): Array<{ type: DetailSectionType; re: RegExp }> {
  return (Object.keys(MODETOUR_SECTION_ANCHOR_ALIASES) as DetailSectionType[]).map((type) => ({
    type,
    re: new RegExp(
      `(${MODETOUR_SECTION_ANCHOR_ALIASES[type]
        .slice()
        .sort((a, b) => b.length - a.length)
        .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|')})`,
      'i'
    ),
  }))
}

const MODETOUR_STARTERS = buildModetourAnchorStarters()

function isFalseShoppingAnchorLineModetour(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (/^\[선택관광/i.test(t)) return true
  if (/선택관광\s*[-–]?\s*\$?\d/.test(t) && /\/인\]?\s*$/i.test(t)) return true
  return /(쇼핑항목|쇼핑장소|쇼핑\s*품목|쇼핑샵명)/i.test(line) && !/^쇼핑정보/i.test(t)
}

function isFalseHotelAnchorLineModetour(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (/예정호텔[은는이가이며]\b/i.test(t)) return true
  if (/(?:일급|동급|특급|[0-9]\s*성)\s*호텔\b/i.test(t)) return true
  if (/숙박시설/i.test(t)) return true
  /** 모두투어 표 안 "호텔명" 열 헤더 줄 */
  if (/^호텔명\b/i.test(t) && t.length < 24) return true
  return false
}

function splitModetourSectionsByAnchors(normalized: string): Array<{ type: DetailSectionType; text: string }> {
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
    const hit = MODETOUR_STARTERS.find((s) => {
      const t = line.trim()
      if (s.type === 'hotel_section') {
        if (/^호텔$/i.test(t)) return true
        if (!s.re.test(line)) return false
        if (isFalseHotelAnchorLineModetour(line)) return false
        return true
      }
      if (!s.re.test(line)) return false
      if (s.type === 'shopping_section' && isFalseShoppingAnchorLineModetour(line)) return false
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

/** 모두투어는 표·항공 블록이 길게 잡히는 경우가 많아 시드 하한을 96으로 둔다. */
const MODETOUR_FLIGHT_SEED_MIN_LEN = 96

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
    flightSectionSeed.length < MODETOUR_FLIGHT_SEED_MIN_LEN ? normalizedRaw : flightSectionSeed
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

/** UI·이미지·로고 등 정보 손실 없이 제거 가능한 단독 줄 (모두투어 붙여넣기 1차) */
function isModetourSafeNoiseStandaloneLine(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (/^더보기$/i.test(t)) return true
  if (/^크게\s*보기$/i.test(t)) return true
  if (/^이미지설명$/i.test(t)) return true
  if (/Pexels\s*스톡\s*이미지/i.test(t)) return true
  if (/^행사인원에\s*따라\s*행사차량이\s*변경될\s*수\s*있습니다\.?$/i.test(t)) return true
  if (/^logo-koreanair$/i.test(t)) return true
  if (/^logo$/i.test(t)) return true
  return false
}

/** 단독 줄이 아닌 UI 잡음(리뷰·배너 등) — 줄 전체가 해당 패턴일 때만 제거 */
function isModetourBroadUiNoiseLine(line: string): boolean {
  return /(후기|리뷰|좋아요|공유|배너|이벤트|버튼|^[-_=]{3,}$|모두투어\s*예약|상담\s*문의|고객\s*만족)/i.test(line)
}

/** 단독 'Image' 줄이 3회 이상 연속일 때만 제거(1~2줄은 유지) */
function dropConsecutiveStandaloneImageRuns(lines: string[]): string[] {
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    if (/^image$/i.test(lines[i]!.trim())) {
      let j = i
      while (j < lines.length && /^image$/i.test(lines[j]!.trim())) j++
      if (j - i >= 3) {
        i = j
        continue
      }
      for (let k = i; k < j; k++) out.push(lines[k]!)
      i = j
      continue
    }
    out.push(lines[i]!)
    i++
  }
  return out
}

function splitModetourRawLines(raw: string): string[] {
  return raw
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\t/g, ' ').trim())
    .filter((l) => l.length > 0)
}

/** 1차: UI·Image 잡음 제거 (진단·2차 전 단계) */
function applyModetourNormalizePhase1Lines(raw: string): string[] {
  return dropConsecutiveStandaloneImageRuns(
    splitModetourRawLines(raw).filter(
      (l) => !isModetourBroadUiNoiseLine(l) && !isModetourSafeNoiseStandaloneLine(l)
    )
  )
}

function isModetourHotelBoxStopLine(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (/^식사\b/i.test(t)) return true
  if (/^현지교통\b/i.test(t)) return true
  if (/^\d{1,2}\s*일차\b/i.test(t)) return true
  return false
}

/** 단독 `예정호텔` 줄 + 직후 호텔명·등급(최대 2줄). 식사·교통·일차 헤더에서 중단 */
function dropModetourHotelBoxLines(lines: string[]): string[] {
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    if (/^예정호텔$/i.test(lines[i]!.trim())) {
      i++
      let skipped = 0
      while (i < lines.length && skipped < 2 && !isModetourHotelBoxStopLine(lines[i]!)) {
        i++
        skipped++
      }
      continue
    }
    out.push(lines[i]!)
    i++
  }
  return out
}

const MODETOUR_ATTRACTION_DESC_MIN_LEN = 75

function isModetourClassificationTagOnlyLine(line: string): boolean {
  return /^\[(?:외부관람|조망|내부관람|내부|차창|차창관광)\]\s*$/i.test(line.trim())
}

function shouldPreserveModetourAttractionLine(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  if (isModetourClassificationTagOnlyLine(t)) return true
  if (/^\[?(?:조식|중식|석식)\]?/i.test(t)) return true
  if (/^(?:조식|중식|석식)\s*[-–:：]/i.test(t)) return true
  if (/^식사\b/i.test(t)) return true
  if (/^현지교통\b/i.test(t)) return true
  if (/약\s*\d+\s*(?:시간|분|hr|h)\s*소요/i.test(t)) return true
  if (/→/.test(t) && /이동/.test(t)) return true
  if (/^\d{1,2}\s*일차\b/i.test(t)) return true
  if (/^예정호텔$/i.test(t)) return true
  if (/^■\s*/.test(t) || /^※/.test(t)) return true
  if (/^<.+>$/.test(t)) return true
  return false
}

/** 관광지명(≤50자, `[조망]` 등 분류 접미 포함 가능) */
function looksLikeModetourAttractionTitleLine(line: string): boolean {
  const t = line.trim()
  if (!t || t.length > 50) return false
  if (/^\d{1,2}\s*일차\b/i.test(t)) return false
  if (/^식사\b/i.test(t)) return false
  if (/^현지교통\b/i.test(t)) return false
  if (/^예정호텔$/i.test(t)) return false
  if (/^■\s*/.test(t) || /^※/.test(t)) return false
  if (/^<.+>$/.test(t)) return false
  if (/약\s*\d+\s*(?:시간|분|hr|h)\s*소요/i.test(t) && !/\[(?:외부관람|조망|내부)\]/i.test(t)) return false
  if (/→/.test(t) && /이동/.test(t) && !/\[(?:외부관람|조망|내부)\]/i.test(t)) return false
  if (isModetourBroadUiNoiseLine(t) || isModetourSafeNoiseStandaloneLine(t)) return false
  if (/^image$/i.test(t)) return false
  return true
}

function isModetourAttractionCardMetaLine(line: string): boolean {
  return /^(?:가는방법|관람소요시간)\s*[:：]/i.test(line.trim())
}

/** 관광지명(짧은 줄) 다음 긴 설명(100자+)만 앞 50자로 축약 */
function truncateModetourAttractionDescriptions(lines: string[]): string[] {
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const cur = lines[i]!
    if (!looksLikeModetourAttractionTitleLine(cur)) {
      out.push(cur)
      i++
      continue
    }
    out.push(cur)
    let j = i + 1
    while (j < lines.length) {
      const t = lines[j]!.trim()
      if (looksLikeModetourAttractionTitleLine(lines[j]!)) break
      if (t.length > 0 && t.length <= 50 && !shouldPreserveModetourAttractionLine(lines[j]!)) {
        out.push(lines[j]!)
        j++
        continue
      }
      if (shouldPreserveModetourAttractionLine(lines[j]!) && t.length < 100) {
        out.push(lines[j]!)
        j++
        continue
      }
      break
    }
    while (j < lines.length) {
      const para = lines[j]!.trim()
      if (looksLikeModetourAttractionTitleLine(lines[j]!)) break
      if (shouldPreserveModetourAttractionLine(lines[j]!)) break
      if (para.length > 51) {
        out.push(`${para.slice(0, 50)}…`)
        j++
        continue
      }
      break
    }
    i = j
  }
  return out
}

function dropModetourAttractionCardMetaLines(lines: string[]): string[] {
  return lines.filter((l) => !isModetourAttractionCardMetaLine(l))
}

/** 관광 카드 '개요 :' 장문(다음 설명과 중복) 제거 */
function dropModetourAttractionOverviewLines(lines: string[]): string[] {
  return lines.filter((l) => !/^개요\s*[:：]/i.test(l.trim()))
}

/** 긴 ■ 유의 문구는 앞 50자만 유지(일정 핵심·식사·이동은 그대로) */
function truncateModetourLongBulletNotices(lines: string[]): string[] {
  return lines.map((l) => {
    const t = l.trim()
    if (/^■\s*/.test(t) && t.length > 51) return `${t.slice(0, 50)}…`
    return l
  })
}

/** 긴 ※ 참고 줄(유의사항 박스 마커 제외) 축약 */
function truncateModetourLongFootnoteLines(lines: string[]): string[] {
  return lines.map((l) => {
    const t = l.trim()
    if (isModetourNoticeBlockStart(t)) return l
    if (/^※/.test(t) && t.length > 51) return `${t.slice(0, 50)}…`
    return l
  })
}

/** 관광지명 체인 밖 남은 긴 산문(50자+) — 항공·미팅·이동·분류 태그 줄 제외 */
function truncateModetourStandaloneLongProse(lines: string[]): string[] {
  return lines.map((l) => {
    const t = l.trim()
    if (t.length <= 51) return l
    if (/^<.+>$/.test(t)) return `${t.slice(0, 50)}…`
    if (shouldPreserveModetourAttractionLine(l)) return l
    if (looksLikeModetourAttractionTitleLine(l)) return l
    if (/^(?:출발|도착)\s*:/i.test(t)) return l
    if (/인천국제공항|여행사\s*카운터|인솔자\s*배정/i.test(t)) return l
    return `${t.slice(0, 50)}…`
  })
}

function dropModetourConsecutiveDuplicateLines(lines: string[]): string[] {
  const out: string[] = []
  for (const l of lines) {
    if (out.length > 0 && out[out.length - 1] === l) continue
    out.push(l)
  }
  return out
}

function isModetourNoticeBlockStart(line: string): boolean {
  const t = line.trim()
  return (
    /^유의\s*[ㅣ|]\s*안내사항/i.test(t) ||
    /^※\s*참고사항/i.test(t) ||
    /^※\s*유의사항/i.test(t)
  )
}

function isModetourNoticeBlockStop(line: string): boolean {
  return /^\d{1,2}\s*일차\b/i.test(line.trim())
}

/** 유의·참고 박스 — 다음 일차 헤더까지 제거 */
function dropModetourNoticeBlocks(lines: string[]): string[] {
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    if (isModetourNoticeBlockStart(lines[i]!)) {
      i++
      while (i < lines.length && !isModetourNoticeBlockStop(lines[i]!)) {
        i++
      }
      continue
    }
    out.push(lines[i]!)
    i++
  }
  return out
}

function applyModetourNormalizePhase2Lines(lines: string[]): string[] {
  return dropModetourConsecutiveDuplicateLines(
    dropModetourNoticeBlocks(
      truncateModetourStandaloneLongProse(
        truncateModetourLongFootnoteLines(
          truncateModetourLongBulletNotices(
            dropModetourAttractionOverviewLines(
              dropModetourAttractionCardMetaLines(
                truncateModetourAttractionDescriptions(dropModetourHotelBoxLines(lines))
              )
            )
          )
        )
      )
    )
  )
}

function joinModetourNormalizedLines(lines: string[]): string {
  return lines.join('\n').replace(/\n{3,}/g, '\n\n')
}

/** 1차 전처리만 (진단 비교용) */
export function normalizeDetailRawTextPhase1(raw: string): string {
  return joinModetourNormalizedLines(applyModetourNormalizePhase1Lines(raw))
}

export function normalizeDetailRawText(raw: string): string {
  const phase1 = applyModetourNormalizePhase1Lines(raw)
  return joinModetourNormalizedLines(applyModetourNormalizePhase2Lines(phase1))
}

export function splitDetailSections(normalized: string): Array<{ type: DetailSectionType; text: string }> {
  return splitModetourSectionsByAnchors(normalized)
}

/** 레거시·비등록 용도. 관리자 등록 SSOT는 `detail-body-parser-modetour`의 전용 포함/불포함 파서를 쓴다. */
export function parseIncludedExcludedSection(section: string): IncludedExcludedStructured {
  const lines = section.split('\n').map(cleanLine).filter(Boolean)
  const includedItems = lines.filter((l) => /(포함|included)/i.test(l)).slice(0, 30)
  const excludedItems = lines
    .filter((l) => /(불포함|excluded|별도|별도\s*경비)/i.test(l))
    .slice(0, 30)
  return {
    includedItems,
    excludedItems,
    noteText: lines.filter((l) => !/(포함|불포함|included|excluded)/i.test(l)).slice(0, 10).join('\n'),
    reviewNeeded: includedItems.length === 0 && excludedItems.length === 0 && section.trim().length > 0,
    reviewReasons:
      includedItems.length === 0 && excludedItems.length === 0 && section.trim().length > 0 ? ['포함/불포함 분리 실패'] : [],
  }
}
