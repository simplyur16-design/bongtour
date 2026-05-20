/**
 * 참좋은여행(verygoodtour) 붙여넣기 상단에서 **원문 상품명 한 줄** 추출.
 * LLM·항공 안내(출도착/현지시각/출발일변경) 오염 방지 SSOT.
 */

import { extractDestinationFromTitle } from '@/lib/destination-from-title'

const SKIP_LINE_RE =
  /^(상품(?:코드|번호)|담당자|문의|예약|인쇄|공유|https?:|▼|▶|■|※\s*유의|포함사항|불포함|여행\s*일정|상품\s*개요|HOME|고위험|여행\s*주요)/i

/** 항공·가격 UI가 한 줄로 붙은 경우 제외 */
const TITLE_JUNK_RE =
  /출도착|현지\s*시각|정부\s*인가|출발일\s*변경|스케줄\s*은|항공여정|변경\s*될\s*수|유류할증|예약현황|잔여석|싱글차지|무이자할부|총\s*금액/i

/** `3박5일`만 있거나 기간+항공사명+안내 문구로 이어진 줄 */
const DURATION_ONLY_OR_CHROME_RE = /^(?:\d+\s*박\s*\d+\s*일(?:\s*이스타)?|\d+\s*일\s*\d+\s*박)/i

/** `[치앙마이/치앙라이] #태그…` 형태 */
const BRACKET_HASH_TITLE_RE = /^\[[^\]\n]{2,80}\].*#/

function normalizePasteLines(blob: string): string[] {
  return blob
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .slice(0, 12_000)
    .split('\n')
    .map((l) => l.replace(/\u00a0/g, ' ').trim())
    .filter(Boolean)
}

function isVerygoodListingTitleLine(line: string): boolean {
  if (line.length < 12 || line.length > 240) return false
  if (SKIP_LINE_RE.test(line)) return false
  if (TITLE_JUNK_RE.test(line)) return false
  if (/^https?:\/\//i.test(line)) return false
  if (DURATION_ONLY_OR_CHROME_RE.test(line)) return false
  return true
}

/** `[도시/도시] #옵션…` 우선 */
function pickBracketHashTitle(lines: string[]): string | null {
  for (const line of lines.slice(0, 80)) {
    if (!isVerygoodListingTitleLine(line)) continue
    if (BRACKET_HASH_TITLE_RE.test(line)) return line
  }
  return null
}

/** `#` 태그 2개 이상 — 기간·항공 안내 줄 제외 */
function pickHashTagTitle(lines: string[]): string | null {
  for (const line of lines.slice(0, 80)) {
    if (!isVerygoodListingTitleLine(line)) continue
    const hashCount = (line.match(/#/g) || []).length
    if (hashCount >= 2 && !/(?:\d+\s*박\s*\d+\s*일)\s*이스타/i.test(line)) return line
  }
  return null
}

function pickLegacyTourShapeTitle(lines: string[]): string | null {
  for (const line of lines.slice(0, 70)) {
    if (!isVerygoodListingTitleLine(line)) continue
    const hasTourShape = /(?:\d+\s*일|\d+\s*박|\d+\s*국)/.test(line)
    const hashCount = (line.match(/#/g) || []).length
    const hasBracketLead = /^\[/.test(line)
    if ((hasTourShape && hashCount >= 1 && line.length >= 32) || (hasBracketLead && hasTourShape)) {
      return line
    }
  }
  for (const line of lines.slice(0, 28)) {
    if (!isVerygoodListingTitleLine(line)) continue
    if (/[가-힣]{8,}/.test(line) && /\d/.test(line) && /[#\[\]일박국]/.test(line)) return line
  }
  return null
}

/**
 * 붙여넣기 상단에서 참좋은 상품 리스트 제목 한 줄(원문, `#` 유지).
 */
export function extractVerygoodtourVerbatimListingTitleFromPaste(blob: string): string | null {
  const lines = normalizePasteLines(blob)
  return pickBracketHashTitle(lines) ?? pickHashTagTitle(lines) ?? pickLegacyTourShapeTitle(lines)
}

/** `[치앙마이/치앙라이]` → 메가메뉴·geo 힌트용 대표 목적지 */
/** LLM이 항공·가격 UI 문구를 제목으로 낸 경우 폴백 차단 */
export function isVerygoodtourAirlineOrPriceChromeTitle(line: string): boolean {
  const t = String(line ?? '').trim()
  if (!t) return true
  return TITLE_JUNK_RE.test(t) || DURATION_ONLY_OR_CHROME_RE.test(t)
}

const POLICY_BRACKET_TOKEN_RE =
  /^(?:노\s*)?(?:쇼핑|옵션|업션|팁)|NO\s*(?:쇼핑|옵션|팁)|인솔자\s*동행|노옵션|노업션|노쇼핑|노팁/i

/** `[노쇼핑, 노업션, 노팁]` 등 정책 뱃지 — 지역·목적지로 쓰지 않음 */
export function isVerygoodtourPolicyBracketDestination(inner: string): boolean {
  const raw = String(inner ?? '').trim()
  if (!raw) return true
  const parts = raw
    .split(/[,，·/／\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return true
  return parts.every((p) => POLICY_BRACKET_TOKEN_RE.test(p.replace(/\s+/g, '')))
}

export function extractVerygoodDestinationFromBracketTitle(title: string): string | null {
  const t = String(title ?? '').trim()
  if (!t) return null
  const re = /\[([^\]]+)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t)) !== null) {
    const inner = m[1]!.replace(/\s+/g, ' ').trim()
    if (!inner || isVerygoodtourPolicyBracketDestination(inner)) continue
    const parts = inner
      .split(/[/／·]/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length === 0) continue
    if (parts.length === 1) return parts[0]!
    return parts.join(' · ')
  }
  return null
}

/** 관리자 목록·카드 — 정책 뱃지가 destination에 들어간 기등록 상품 폴백 */
export function resolveProductListDestinationLabel(input: {
  primaryDestination?: string | null
  destination?: string | null
  destinationRaw?: string | null
  primaryRegion?: string | null
  title?: string | null
}): string {
  const candidates = [
    input.primaryDestination,
    input.destination,
    input.destinationRaw,
    input.primaryRegion,
  ]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
  for (const c of candidates) {
    if (!isVerygoodtourPolicyBracketDestination(c)) return c
  }
  const fromTitle = extractDestinationFromTitle(input.title ?? '')
  if (fromTitle !== '미지정') return fromTitle
  return '—'
}
