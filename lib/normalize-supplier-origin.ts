/**
 * 공급사 originSource 문자열 정규화 — 표기 흔들림(하나, HANATOUR 등)을 내부 키로 수렴.
 * 해외 랜딩 공급사별 탭·필터의 SSOT.
 */

export type OverseasSupplierKey = 'hanatour' | 'modetour' | 'verygoodtour' | 'ybtour' | 'etc'

export const OVERSEAS_SUPPLIER_LABEL: Record<OverseasSupplierKey, string> = {
  hanatour: '하나투어',
  modetour: '모두투어',
  verygoodtour: '참좋은여행사',
  ybtour: '노랑풍선',
  etc: '기타 공급사',
}

const RULES: { key: OverseasSupplierKey; patterns: RegExp[] }[] = [
  {
    key: 'hanatour',
    patterns: [/하나투어/i, /\bhanatour\b/i, /\bhana\s*tour\b/i, /^hana$/i, /하나\s*투어/i],
  },
  {
    key: 'modetour',
    patterns: [/모두투어/i, /\bmodetour\b/i, /\bmodu\s*tour\b/i, /^modu$/i, /모두\s*투어/i],
  },
  {
    key: 'verygoodtour',
    patterns: [
      /참좋은여행사/i,
      /참좋은여행/i,
      /참좋은/i,
      /\bverygoodtour\b/i,
      /\bvery\s*good/i,
      /verygood/i,
    ],
  },
  {
    key: 'ybtour',
    patterns: [/노랑풍선/i, /노랑/i, /\byb\s*tour\b/i, /yellow\s*balloon/i, /^\s*yellow\s*$/i],
  },
]

/**
 * @returns 내부 공급사 키. 어떤 규칙에도 안 맞으면 `etc`.
 */
export function normalizeSupplierOrigin(originSource: string | null | undefined): OverseasSupplierKey {
  const raw = (originSource ?? '').trim()
  if (!raw) return 'etc'
  const s = raw.toLowerCase()
  for (const { key, patterns } of RULES) {
    for (const re of patterns) {
      if (re.test(raw) || re.test(s)) return key
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
