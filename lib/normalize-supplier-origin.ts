/**
 * 공급사 originSource 문자열 정규화 — canonical key(SSOT) 우선, 그다음 표기·레거시 별칭.
 * 해외 랜딩 공급사별 탭·필터·등록 라우트 가드와 동일 기준을 쓴다.
 */
import {
  tryResolveCanonicalSupplierKeyAscii,
  type CanonicalOverseasSupplierKey,
} from '@/lib/overseas-supplier-canonical-keys'

export type OverseasSupplierKey = CanonicalOverseasSupplierKey | 'etc'

export const OVERSEAS_SUPPLIER_LABEL: Record<OverseasSupplierKey, string> = {
  hanatour: '하나투어',
  modetour: '모두투어',
  verygoodtour: '참좋은여행사',
  ybtour: '노랑풍선',
  kyowontour: '교원이지',
  lottetour: '롯데관광',
  etc: '기타 공급사',
}

/** 2순위: 전체 문자열 일치(정규식보다 우선·의도 명확). 레거시 토큰만 둔다. */
function legacyExactAliasToKey(trimmed: string): OverseasSupplierKey | null {
  const lower = trimmed.toLowerCase()
  if (lower === 'yellowballoon') return 'ybtour'
  if (trimmed === '노랑') return 'ybtour'
  return null
}

/** 2순위: 표시명·흔한 표기·오타(느슨한 단일 토큰 패턴은 넣지 않는다). */
const PATTERN_RULES: { key: CanonicalOverseasSupplierKey; patterns: RegExp[] }[] = [
  {
    key: 'hanatour',
    patterns: [/하나투어/i, /\bhana\s*tour\b/i, /^hana$/i, /하나\s*투어/i],
  },
  {
    key: 'modetour',
    patterns: [/모두투어/i, /\bmodu\s*tour\b/i, /^modu$/i, /모두\s*투어/i],
  },
  {
    key: 'verygoodtour',
    patterns: [/참좋은여행사/i, /참좋은여행/i, /\bvery\s*good/i, /\bverygood\b/i],
  },
  {
    key: 'ybtour',
    patterns: [/노랑풍선/i, /\byb\s*tour\b/i, /yellow\s*balloon/i, /^\s*yellow\s*$/i],
  },
  {
    key: 'kyowontour',
    patterns: [
      /\bkyowontour\b/i,
      /교원이지/i,
      /교원이지/i,
      /교원투어/i,
      /교원\s*투어/i,
      /교보\s*이지/i,
    ],
  },
  {
    key: 'lottetour',
    patterns: [
      /\blottetour\b/i,
      /롯데관광/i,
      /롯데\s*관광/i,
      /lotte\s*tour/i,
    ],
  },
]

/**
 * @returns 내부 공급사 키. 어떤 규칙에도 안 맞으면 `etc`.
 * 1) canonical 해외 공급사 ASCII 키(대소문자 무시) → 해당 키
 * 2) 레거시 전체 문자열 별칭(예: yellowballoon)
 * 3) 표시명·흔한 표기 패턴
 */
export function normalizeSupplierOrigin(originSource: string | null | undefined): OverseasSupplierKey {
  const raw = (originSource ?? '').trim()
  if (!raw) return 'etc'

  const asciiCanonical = tryResolveCanonicalSupplierKeyAscii(raw)
  if (asciiCanonical) return asciiCanonical

  const legacy = legacyExactAliasToKey(raw)
  if (legacy) return legacy

  const lower = raw.toLowerCase()
  for (const { key, patterns } of PATTERN_RULES) {
    for (const re of patterns) {
      if (re.test(raw) || re.test(lower)) return key
    }
  }
  return 'etc'
}

export function supplierOriginMatchesKey(
  originSource: string | null | undefined,
  key: OverseasSupplierKey
): boolean {
  return normalizeSupplierOrigin(originSource) === key
}
