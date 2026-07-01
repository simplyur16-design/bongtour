/** 이메일 로그인 입력 — `@` 없으면 테스트 ID 도메인(`@test.bongtour`) 보정 */
export function normalizeCredentialsLoginEmail(raw: string): string {
  const v = raw.trim().toLowerCase()
  if (!v) return ''
  if (v.includes('@')) return v
  return `${v}@test.bongtour`
}
