/**
 * 상품 URL 호스트 → canonical 공급사 키 (관리자 등록 UX).
 * REGRESSION-FREEZE[infer-supplier-from-origin-url]
 */
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'

const HOST_PATTERNS: ReadonlyArray<{ pattern: RegExp; supplier: CanonicalOverseasSupplierKey }> = [
  { pattern: /(?:^|\.)hanatour\.com$/i, supplier: 'hanatour' },
  { pattern: /(?:^|\.)modetour\.com$/i, supplier: 'modetour' },
  { pattern: /(?:^|\.)ybtour\.co\.kr$/i, supplier: 'ybtour' },
  { pattern: /(?:^|\.)verygoodtour\.com$/i, supplier: 'verygoodtour' },
  { pattern: /(?:^|\.)lottetour\.com$/i, supplier: 'lottetour' },
  { pattern: /(?:^|\.)kyowontour\.com$/i, supplier: 'kyowontour' },
]

/** URL에서 공급사 canonical key 추론 — 실패 시 null */
export function inferCanonicalSupplierFromOriginUrl(
  originUrl: string | null | undefined,
): CanonicalOverseasSupplierKey | null {
  const raw = (typeof originUrl === 'string' ? originUrl : '').trim()
  if (!raw) return null
  try {
    const host = new URL(raw).hostname.trim().toLowerCase()
    if (!host) return null
    for (const { pattern, supplier } of HOST_PATTERNS) {
      if (pattern.test(host)) return supplier
    }
    return null
  } catch {
    return null
  }
}
