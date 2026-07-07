/** .p8 PEM 정규화·형식 검사 — node:crypto 없음(sign-in-method-catalog·클라이언트에서 import 가능) */

export function normalizeApplePrivateKeyPem(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed.includes('BEGIN PRIVATE KEY')) {
    return trimmed.replace(/\\n/g, '\n')
  }
  const body = trimmed.replace(/\\n/g, '\n').replace(/\s+/g, '')
  const lines = body.match(/.{1,64}/g) ?? []
  return ['-----BEGIN PRIVATE KEY-----', ...lines, '-----END PRIVATE KEY-----'].join('\n')
}

/** BEGIN 한 줄만 붙여넣은 env 등 — JWT 서명 전에 걸러서 앱 기동 크래시 방지 */
export function isApplePrivateKeyPemPlausible(pem: string): boolean {
  const normalized = normalizeApplePrivateKeyPem(pem)
  if (!normalized.includes('BEGIN PRIVATE KEY') || !normalized.includes('END PRIVATE KEY')) {
    return false
  }
  const body = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  return body.length >= 64
}
