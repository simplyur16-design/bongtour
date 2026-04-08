/**
 * 비행 소요시간 — 본문 추출·시각 차이 계산·사용자 표시 문구.
 */
import { parseKoreanDateTimeLineToDate } from '@/lib/flight-korean-datetime'

/** `약 2시간 20분`, `비행소요시간 1시간 10분`, `소요시간 2시간` 등 */
export function extractFlightDurationMinutesFromText(block: string | null | undefined): number | null {
  if (!block?.trim()) return null
  const t = block.replace(/\s+/g, ' ')
  const reList = [
    /(?:비행\s*소요\s*시간|비행\s*시간|비행소요시간|소요\s*시간|비행\s*시간)\s*[：:]\s*(\d+)\s*시간\s*(\d+)\s*분/i,
    /(?:비행\s*소요\s*시간|비행소요시간|소요\s*시간)\s*(\d+)\s*시간\s*(\d+)\s*분/i,
    /약\s*(\d+)\s*시간\s*(\d+)\s*분/i,
    /(\d+)\s*시간\s*(\d+)\s*분(?!\s*이상)/i,
    /(?:비행\s*소요\s*시간|소요\s*시간)\s*[：:]?\s*(\d+)\s*시간(?!\s*\d+분)/i,
    /약\s*(\d+)\s*시간(?!\s*\d)/i,
  ]
  for (const re of reList) {
    const m = t.match(re)
    if (!m) continue
    const h = parseInt(m[1], 10)
    const min = m[2] != null ? parseInt(m[2], 10) : 0
    if (Number.isFinite(h) && h >= 0 && Number.isFinite(min) && min >= 0) return h * 60 + min
  }
  return null
}

export function formatDurationKorean(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return ''
  const h = Math.floor(totalMinutes / 60)
  const m = Math.round(totalMinutes % 60)
  if (h > 0 && m > 0) return `${h}시간 ${m}분`
  if (h > 0) return `${h}시간`
  return `${m}분`
}

export function formatFlightDurationUserLine(totalMinutes: number | null): string | null {
  if (totalMinutes == null || !Number.isFinite(totalMinutes) || totalMinutes < 0) return null
  const inner = formatDurationKorean(totalMinutes)
  if (!inner) return null
  return `비행소요시간 ${inner}`
}

/** 출발·도착 시각 문자열이 있으면 분 단위 차이(야간·익일 도착 반영) */
export function computeFlightDurationMinutesFromLegTexts(
  departureAtText: string | null | undefined,
  arrivalAtText: string | null | undefined
): number | null {
  const a = parseKoreanDateTimeLineToDate(departureAtText ?? null)
  const b = parseKoreanDateTimeLineToDate(arrivalAtText ?? null)
  if (!a || !b) return null
  let diff = b.getTime() - a.getTime()
  if (diff < 0) diff += 24 * 60 * 60 * 1000
  const mins = Math.round(diff / 60000)
  if (mins <= 0 || mins > 48 * 60) return null
  return mins
}
