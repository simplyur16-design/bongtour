/**
 * 달력 로그용 날짜 정규화.
 * '26.04.17(금)', '26-04-17' 등 → '2026-04-17'
 * 텍스트에 없는 날짜는 생성하지 않음(팩트만).
 */
export function normalizeCalendarDate(input: string): string | null {
  const s = String(input ?? '').trim()
  if (!s) return null
  // YYYY-MM-DD 이미면 10자리 검증
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // yy.mm.dd 또는 yy-mm-dd (요일 괄호 제거)
  const match = s.replace(/\s*\([^)]*\)\s*$/, '').match(/^(\d{2,4})[.\-](\d{1,2})[.\-](\d{1,2})$/)
  if (!match) return null
  let y = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const d = parseInt(match[3], 10)
  if (y < 100) y = y >= 50 ? 1900 + y : 2000 + y
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const yy = y.toString().padStart(4, '0')
  const mm = m.toString().padStart(2, '0')
  const dd = d.toString().padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
