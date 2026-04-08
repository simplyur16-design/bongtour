/**
 * 상세 설명 텍스트 내 불필요한 HTML 태그·특수문자 정제.
 * 허용: 줄바꿈, 공백, 일반 문장 부호. 태그는 제거 후 텍스트만 반환.
 */
export function sanitizeDetailText(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== 'string') return ''
  let s = raw
  // HTML 태그 제거 (내용은 유지하지 않고 제거)
  s = s.replace(/<[^>]+>/g, ' ')
  // 연속 공백/줄바꿈을 하나로
  s = s.replace(/\s+/g, ' ')
  // 제어 문자 제거
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  return s.trim()
}
