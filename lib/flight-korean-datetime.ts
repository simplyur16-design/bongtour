/**
 * 항공 카드용 한국어 날짜·시각 문자열 파싱/포맷 (상세 공통).
 */

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

/** `2026.07.07(화) 19:20` 등에서 시:분만 */
export function extractHmFromKoreanDateTimeLine(s: string | null | undefined): string | null {
  if (!s?.trim()) return null
  const m = s.match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

/** `2026.07.07(화) 19:20` → Date (로컬) */
export function parseKoreanDateTimeLineToDate(s: string | null | undefined): Date | null {
  if (!s?.trim()) return null
  const m = s.match(
    /(\d{4})[.](\d{1,2})[.](\d{1,2})(?:\([^)]*\))?\s+(\d{1,2}):(\d{2})/
  )
  if (!m) return null
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10) - 1
  const d = parseInt(m[3], 10)
  const hh = parseInt(m[4], 10)
  const mm = parseInt(m[5], 10)
  const dt = new Date(y, mo, d, hh, mm, 0, 0)
  return Number.isNaN(dt.getTime()) ? null : dt
}

/** fmtKoreanDateTime과 동일 규칙 */
export function formatKoreanDateTimeLine(d: Date | null | undefined): string | null {
  if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const wd = WEEKDAY_KO[d.getDay()]
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${m}.${day}(${wd}) ${hh}:${mm}`
}

/** `YYYY-MM-DD` 기준으로 시·분만 다른 새 Date */
export function combineDateKeyWithHm(dateKey: string, hm: string | null): Date | null {
  if (!hm?.trim()) return null
  const dk = dateKey.trim().slice(0, 10)
  const dm = dk.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const tm = hm.match(/^(\d{1,2}):(\d{2})$/)
  if (!dm || !tm) return null
  const y = parseInt(dm[1], 10)
  const mo = parseInt(dm[2], 10) - 1
  const d = parseInt(dm[3], 10)
  const hh = parseInt(tm[1], 10)
  const mm = parseInt(tm[2], 10)
  const dt = new Date(y, mo, d, hh, mm, 0, 0)
  return Number.isNaN(dt.getTime()) ? null : dt
}
