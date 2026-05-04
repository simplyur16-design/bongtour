/**
 * 해외 랜딩 공급사 canonical key — route guard·`normalizeSupplierOrigin`·관리자 등록·검증 스크립트의 공통 SSOT.
 * 목록은 `overseas-supplier-canonical-keys.json` 한 곳만 편집한다.
 */
import canonicalJson from './overseas-supplier-canonical-keys.json'

const EXPECTED = new Set(['hanatour', 'modetour', 'ybtour', 'verygoodtour', 'kyowontour', 'lottetour'])

if (
  !Array.isArray(canonicalJson) ||
  canonicalJson.length !== 6 ||
  !canonicalJson.every((x): x is string => typeof x === 'string' && EXPECTED.has(x)) ||
  new Set(canonicalJson).size !== 6
) {
  throw new Error(
    'lib/overseas-supplier-canonical-keys.json must be a length-6 array of: hanatour, modetour, ybtour, verygoodtour, kyowontour, lottetour (no duplicates).'
  )
}

export type CanonicalOverseasSupplierKey =
  | 'hanatour'
  | 'modetour'
  | 'ybtour'
  | 'verygoodtour'
  | 'kyowontour'
  | 'lottetour'

export const CANONICAL_OVERSEAS_SUPPLIER_KEYS = canonicalJson as readonly CanonicalOverseasSupplierKey[]

/** 라우트 가드 등록 API 기대 공급사 — canonical 키와 동일. */
export type RegisterRouteSupplierKey = CanonicalOverseasSupplierKey

/** `originSource` 등에 쓰는 canonical 문자열(스크립트·테스트에서 리터럴 드리프트 방지). */
export const SUPPLIER_ORIGIN_CANONICAL: Record<CanonicalOverseasSupplierKey, CanonicalOverseasSupplierKey> = {
  hanatour: 'hanatour',
  modetour: 'modetour',
  ybtour: 'ybtour',
  verygoodtour: 'verygoodtour',
  kyowontour: 'kyowontour',
  lottetour: 'lottetour',
}

/**
 * ASCII canonical 키만 1순위로 인정(대소문자 무시 → 소문자 키 반환).
 * @returns 매칭 시 canonical 키, 아니면 null
 */
export function tryResolveCanonicalSupplierKeyAscii(raw: string): CanonicalOverseasSupplierKey | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null
  for (const k of CANONICAL_OVERSEAS_SUPPLIER_KEYS) {
    if (k === t) return k
  }
  return null
}

export function isCanonicalOverseasSupplierKey(s: string): s is CanonicalOverseasSupplierKey {
  return tryResolveCanonicalSupplierKeyAscii(s) !== null
}

/**
 * DB `Brand.brandKey` 등에 남을 수 있는 레거시 토큰 → canonical.
 * (ASCII canonical 4종은 `tryResolveCanonicalSupplierKeyAscii`로 처리)
 */
export const LEGACY_BRAND_KEY_TO_CANONICAL: Readonly<Record<string, CanonicalOverseasSupplierKey>> = {
  yellowballoon: 'ybtour',
  gyowontour: 'kyowontour',
}

/**
 * 저장·API·분기용 — 표시 문자열이 아니라 canonical supplier 키만 반환.
 */
export function normalizeBrandKeyToCanonicalSupplierKey(
  brandKey: string | null | undefined
): CanonicalOverseasSupplierKey | null {
  const ascii = tryResolveCanonicalSupplierKeyAscii(brandKey ?? '')
  if (ascii) return ascii
  const k = (brandKey ?? '').trim().toLowerCase()
  if (!k) return null
  return LEGACY_BRAND_KEY_TO_CANONICAL[k] ?? null
}

export function brandKeyResolvesToYbtour(brandKey: string | null | undefined): boolean {
  return normalizeBrandKeyToCanonicalSupplierKey(brandKey) === 'ybtour'
}
