/** [verygoodtour] register-preview-content-fingerprint */
/**
 * parse-and-register preview ↔ confirm 본문·블록 정합성용 canonical 문자열.
 * 클라이언트·서버 공통 (Node crypto 없음).
 */
export type RegisterPreviewFingerprintBlocks = {
  optionalTour?: string
  shopping?: string
  hotel?: string
  airlineTransport?: string
}

export type RegisterPreviewFingerprintInput = {
  text: string
  brandKey: string | null | undefined
  originUrl: string | null | undefined
  travelScope: string
  pastedBlocks: RegisterPreviewFingerprintBlocks | null | undefined
}

const BLOCK_KEYS = ['airlineTransport', 'hotel', 'optionalTour', 'shopping'] as const

/** parse-and-register 라우트의 originUrl 정규화(길이 상한)와 동일해야 confirm digest가 맞는다 */
function normalizeOriginUrl(u: string | null | undefined): string {
  try {
    let s = (typeof u === 'string' ? u : String(u ?? '')).trim().replace(/\/+$/, '')
    if (!s) return ''
    if (s.length > 2000) s = s.slice(0, 2000)
    return s
  } catch {
    return ''
  }
}

/** preview·confirm 양쪽에서 동일 입력이면 동일 문자열이 나와야 함 */
export function buildRegisterPreviewCanonicalString(input: RegisterPreviewFingerprintInput): string {
  const raw = input.pastedBlocks ?? {}
  const sortedBlocks: Record<string, string> = {}
  for (const k of BLOCK_KEYS) {
    const v = raw[k]
    if (typeof v === 'string' && v.trim()) sortedBlocks[k] = v.trim()
  }
  return JSON.stringify({
    brandKey: (input.brandKey ?? '').trim(),
    originUrl: normalizeOriginUrl(input.originUrl),
    pastedBlocks: sortedBlocks,
    text: (input.text ?? '').trim(),
    travelScope: (input.travelScope ?? '').trim(),
  })
}
