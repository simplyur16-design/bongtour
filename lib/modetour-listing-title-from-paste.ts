/**
 * 모두투어 붙여넣기 상단에서 **원문 상품명 한 줄** 추출.
 * 출발일 구간+박일만 있는 줄(달력 선택 UI)은 상품명이 아니다.
 */
import {
  isModetourDepartureWindowOnlyTitleText,
  isModetourUnacceptableRegisterListingTitle,
} from '@/lib/modetour-departures'

const SKIP_LINE_RE =
  /^(상품(?:코드|번호)|담당자|문의|예약|인쇄|공유|https?:|▼|▶|■|※\s*유의|포함사항|불포함|여행\s*일정|상품\s*개요|HOME|고위험)/i

function normalizePasteLines(blob: string): string[] {
  return blob
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .slice(0, 12_000)
    .split('\n')
    .map((l) => l.replace(/\u00a0/g, ' ').trim())
    .filter(Boolean)
}

function isModetourListingTitleCandidateLine(line: string): boolean {
  if (line.length < 15 || line.length > 220) return false
  if (SKIP_LINE_RE.test(line)) return false
  if (/^https?:\/\//i.test(line)) return false
  if (isModetourDepartureWindowOnlyTitleText(line)) return false
  if (isModetourUnacceptableRegisterListingTitle(line)) return false
  return true
}

/** 붙여넣기 상단부에서 모두투어 상품 리스트 제목 한 줄 원문 추출 */
export function extractModetourVerbatimListingTitleRawFromPaste(blob: string): string | null {
  const lines = normalizePasteLines(blob)
  for (const line of lines.slice(0, 70)) {
    if (!isModetourListingTitleCandidateLine(line)) continue
    const hasTourShape = /(?:\d+\s*일|\d+\s*박|\d+\s*국)/.test(line)
    const hashCount = (line.match(/#/g) || []).length
    const hasBracketLead = /^\[/.test(line)
    if ((hasTourShape && (hashCount >= 1 || line.length >= 32)) || (hasBracketLead && hasTourShape)) {
      return line
    }
  }
  for (const line of lines.slice(0, 28)) {
    if (!isModetourListingTitleCandidateLine(line)) continue
    if (line.length < 14 || line.length > 200) continue
    if (/[가-힣]{8,}/.test(line) && /\d/.test(line) && /[#\[\]일박국]/.test(line)) return line
  }
  return null
}

export { isModetourDepartureWindowOnlyTitleText, isModetourUnacceptableRegisterListingTitle }
