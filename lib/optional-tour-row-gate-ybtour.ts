/**
 * 노랑풍선(ybtour / yellowballoon) 전용 — 선택관광(현지옵션) 행 게이트.
 *
 * 계약
 * - 이 모듈은 노랑풍선 계열 등록/붙여넣기 본문에서 추출한 선택관광 행만 판별한다. 타 공급사 표를 공용 규칙으로 흡수하지 않는다.
 * - 공용 `optional-tour-row-gate.ts`는 두지 않는다. 한 파일로 합치면 공급사별 표기·휴리스틱이 섞여 회귀 시 원인 추적이 어렵다.
 * - 타 브랜드 gate와 로직이 비슷해 보여도 파일을 합치거나 re-export 하지 말 것.
 *
 * 전용 차이(최소)
 * - `BAN_NAME_REGEX`의 브랜드 마일리지 안내 줄: 노랑풍선 브랜드 표기를 패턴 앞쪽에 둔다(가시성·추후 분기 여지).
 */

export type OptionalTourRowFields = {
  name: string
  currency: string | null
  adultPrice: number | null
  childPrice: number | null
  durationText: string | null
  minPaxText: string | null
  guide同行Text: string | null
  waitingPlaceText: string | null
  raw: string
  priceText?: string | null
  alternateScheduleText?: string | null
  supplierTags?: string[] | null
  includedNoExtraCharge?: boolean | null
}

const HEADER_EXACT = new Set(
  [
    '선택경비',
    '관광',
    '관광명',
    '선택관광명',
    '통화',
    '성인',
    '아동',
    '소요시간',
    '최소인원',
    '동행',
    '동행여부',
    '미참여 시',
    '미참여시',
    '선택관광',
    '현지옵션',
    '포함',
    '불포함',
    '쇼핑정보',
    '호텔정보',
    '안내',
    '참고',
    '유의사항',
    '선택관광비용',
    '선택관광비',
    '번호',
    '내용',
    '비용',
    '시간',
    '미참가시',
    '대기일정',
    '대기장소',
  ].map((s) => normalizeKey(s))
)

function normalizeKey(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

const BAN_NAME_REGEX: RegExp[] = [
  /마일리지|포인트|적립/i,
  /본\s*상품은|진행되며|조인|합류|동일항공|타\s*항공|현지에서\s*조인/i,
  /미참여\s*시|선택관광\s*미참여\s*시/i,
  /진행\s*가능합니다|상황에\s*따라|달라질\s*수\s*있습니다/i,
  // 브랜드 마일리지 안내 줄: 이 파일은 노랑풍선 표기를 앞에 둔다(의미 동일, 공급사 전용 파일 가시성).
  /노랑풍선\s*마일리지|하나투어\s*마일리지|모두투어\s*마일리지|참좋은여행\s*마일리지/i,
]

const SENTENCE_END_REGEX =
  /(입니다|됩니다|합니다|하며|수\s*있습니다|가능합니다|확인\s*바랍니다|안내\s*드립니다)\s*\.?$/

function countSpaces(s: string): number {
  return (s.match(/\s/g) ?? []).length
}

function optionalTourNameLooksLikeFusedTableHeaders(t: string): boolean {
  const segments = t.split(/[/／|｜]+/).map((s) => s.trim()).filter(Boolean)
  const pieces = segments.length >= 2 ? segments : t.split(/\s+/).filter(Boolean)
  if (pieces.length < 3) return false
  let headerHits = 0
  for (const p of pieces) {
    const k = normalizeKey(p)
    if (HEADER_EXACT.has(k)) headerHits++
    else if (/^(내용|비용|시간|미참가|대기|동행|번호|통화|소요)$/i.test(p.trim())) headerHits++
  }
  return headerHits >= 3
}

export function isBannedOptionalTourName(name: string): boolean {
  const t = name.replace(/\s+/g, ' ').trim()
  if (!t) return true
  const key = normalizeKey(t)
  if (HEADER_EXACT.has(key)) return true
  if (normalizeKey(t) === '문의') return true
  if (optionalTourNameLooksLikeFusedTableHeaders(t)) return true
  if (t.length > 90) return true
  if (t.length > 42 && countSpaces(t) >= 4) return true
  if (t.length > 28 && countSpaces(t) >= 2 && SENTENCE_END_REGEX.test(t)) return true
  for (const re of BAN_NAME_REGEX) {
    if (re.test(t)) return true
  }
  if (t.length >= 35 && /[은는이가을를에서와과의]$/.test(t) && countSpaces(t) >= 3) return true
  return false
}

function isMeaningfulDurationText(s: string | null | undefined): boolean {
  if (!s?.trim()) return false
  const x = s.trim()
  if (/^(소요시간|최소인원|미참여\s*시)$/i.test(x)) return false
  return /(\d|\b분\b|\b시간\b|hour|min|hrs?)/i.test(x)
}

function isMeaningfulMinPaxText(s: string | null | undefined): boolean {
  if (!s?.trim()) return false
  const x = s.trim()
  if (/^최소인원$/i.test(x)) return false
  return /\d/.test(x) || /명/.test(x)
}

function isMeaningfulGuideText(s: string | null | undefined): boolean {
  if (!s?.trim()) return false
  const x = s.trim()
  if (/^(동행|동행여부|인솔)$/i.test(x)) return false
  return x.length >= 2
}

function isMeaningfulWaitingText(s: string | null | undefined): boolean {
  if (!s?.trim()) return false
  const x = s.trim()
  if (/^미참여\s*시$/i.test(x)) return false
  return x.length >= 2
}

export function hasOptionalTourProductSignals(row: OptionalTourRowFields): boolean {
  if (row.priceText?.replace(/\s+/g, ' ').trim()) return true
  if (row.includedNoExtraCharge === true) return true
  if (Array.isArray(row.supplierTags) && row.supplierTags.some((t) => String(t).trim())) return true
  if (row.currency?.trim() && !/^선택경비$/i.test(row.currency.trim())) return true
  if (row.adultPrice != null && row.adultPrice > 0) return true
  if (row.childPrice != null && row.childPrice > 0) return true
  if (isMeaningfulDurationText(row.durationText)) return true
  if (isMeaningfulMinPaxText(row.minPaxText)) return true
  if (isMeaningfulGuideText(row.guide同行Text)) return true
  if (isMeaningfulWaitingText(row.waitingPlaceText)) return true
  if (row.alternateScheduleText?.replace(/\s+/g, ' ').trim()) return true
  const raw = row.raw?.replace(/\s+/g, ' ').trim() ?? ''
  if (raw && /(USD|\$|원|달러|EUR|JPY|유로|€)\s*[0-9]|[0-9][0-9,]*\s*(원|달러|USD|유로|EUR|€)/i.test(raw)) return true
  return false
}

export function optionalTourRowPassesStrictGate(row: OptionalTourRowFields): boolean {
  const name = row.name?.replace(/\s+/g, ' ').trim() ?? ''
  if (!name) return false
  if (isBannedOptionalTourName(name)) return false
  if (!hasOptionalTourProductSignals(row)) return false
  return true
}

export function filterOptionalTourRows<T extends OptionalTourRowFields>(rows: T[]): T[] {
  return rows.filter((r) => optionalTourRowPassesStrictGate(r))
}
