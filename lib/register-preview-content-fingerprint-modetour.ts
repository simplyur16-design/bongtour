/** [modetour] register-preview-content-fingerprint */
/**
 * parse-and-register preview ↔ confirm 본문·블록 정합성용 canonical 문자열.
 * 클라이언트·서버 공통 (Node crypto 없음).
 */
import {
  MODETOUR_REGISTER_ADMIN_PASTED_BLOCK_KEYS,
  normalizeModetourRegisterOriginUrl,
} from '@/lib/register-admin-core-modetour'

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

/** preview·confirm 양쪽에서 동일 입력이면 동일 문자열이 나와야 함 */
export function buildRegisterPreviewCanonicalString(input: RegisterPreviewFingerprintInput): string {
  const raw = input.pastedBlocks ?? {}
  const sortedBlocks: Record<string, string> = {}
  for (const k of MODETOUR_REGISTER_ADMIN_PASTED_BLOCK_KEYS) {
    const v = raw[k]
    if (typeof v === 'string' && v.trim()) sortedBlocks[k] = v.trim()
  }
  return JSON.stringify({
    brandKey: (input.brandKey ?? '').trim(),
    originUrl: normalizeModetourRegisterOriginUrl(input.originUrl),
    pastedBlocks: sortedBlocks,
    text: (input.text ?? '').trim(),
    travelScope: (input.travelScope ?? '').trim(),
  })
}
