/**
 * 국내 상담 폼용 전화번호 표시 포맷(하이픈).
 * 저장은 표시 문자열 그대로 두되, 검증 시 `digitsOnlyTel` 로 숫자 길이를 본다.
 */

const MAX_DIGITS = 15

export function digitsOnlyTel(input: string): string {
  return input.replace(/\D/g, '').slice(0, MAX_DIGITS)
}

/**
 * 입력·붙여넣기·수정 시 한국식 하이픈 포맷으로 정규화.
 * - 01012341234 → 010-1234-1234
 * - 0101231234 → 010-123-1234
 * - 0212345678 → 02-1234-5678
 */
export function formatKoreanTelInput(raw: string): string {
  const d = digitsOnlyTel(raw)
  if (!d) return ''

  if (d.startsWith('02')) {
    if (d.length <= 2) return d
    if (d.length <= 5) return `02-${d.slice(2)}`
    if (d.length <= 9) return `02-${d.slice(2, 5)}-${d.slice(5)}`
    return `02-${d.slice(2, 6)}-${d.slice(6, 10)}`
  }

  if (d.startsWith('01')) {
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`
    if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`
  }

  if (d[0] === '0') {
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`
    if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  }

  return d
}
