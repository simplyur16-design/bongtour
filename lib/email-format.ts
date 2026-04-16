/** 선택 이메일: 비어 있으면 통과, 값이 있으면 최소 도메인 형태 검사 */
export const OPTIONAL_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const OPTIONAL_EMAIL_FORMAT_ERROR = '올바른 이메일 형식을 입력해 주세요. (예: name@example.com)'

/** trim 후 비어 있으면 null, 형식 오류면 에러 문구, 통과면 null */
export function optionalEmailFormatError(value: string): string | null {
  const t = value.trim()
  if (!t) return null
  return OPTIONAL_EMAIL_REGEX.test(t) ? null : OPTIONAL_EMAIL_FORMAT_ERROR
}
