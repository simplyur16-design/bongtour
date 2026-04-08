/**
 * 항공사 필터 — 내부 코드 ↔ 표시명.
 * 실제 매칭은 `product.airline`·`ProductDeparture.carrierName` 문자열과 정규화 후 비교.
 */
export type AirlineCatalogEntry = {
  code: string
  label: string
  /** 소문자 토큰: 매칭용 */
  matchTokens: string[]
}

/** UI 고정 순서 + 기타(데이터에만 있는 항공사는 facets에서 별도) */
export const AIRLINE_CATALOG: AirlineCatalogEntry[] = [
  { code: 'korean-air', label: '대한항공', matchTokens: ['대한항공', 'korean air', 'ke', 'korean'] },
  { code: 'asiana', label: '아시아나항공', matchTokens: ['아시아나', 'asiana', 'oz'] },
  { code: 'airbusan', label: '에어부산', matchTokens: ['에어부산', 'air busan', 'bx'] },
  { code: 'air-seoul', label: '에어서울', matchTokens: ['에어서울', 'air seoul', 'rs'] },
  { code: 'airok', label: '에어로케이', matchTokens: ['에어로케이', 'airok', 'rf'] },
  { code: 'eastar', label: '이스타항공', matchTokens: ['이스타', 'eastar', 'ze'] },
  { code: 'jeju-air', label: '제주항공', matchTokens: ['제주항공', 'jeju air', '7c'] },
  { code: 'jin-air', label: '진에어', matchTokens: ['진에어', 'jin air', 'lj'] },
  { code: 'tway', label: '티웨이항공', matchTokens: ['티웨이', 'tway', 'tw'] },
]

const EXTRA = { code: 'other', label: '기타', matchTokens: [] as string[] }

export function catalogEntryByCode(code: string): AirlineCatalogEntry | undefined {
  return AIRLINE_CATALOG.find((e) => e.code === code)
}

/** 항공 문자열이 카탈로그 코드에 해당하는지 */
export function airlineStringMatchesCode(haystack: string, code: string): boolean {
  const h = haystack.trim().toLowerCase()
  if (!h) return false
  if (code === 'other') return true
  const entry = catalogEntryByCode(code)
  if (!entry) return false
  return entry.matchTokens.some((t) => h.includes(t.toLowerCase()))
}

/** 상품·출발 행에서 항공 관련 문자열 합치기 */
export function buildAirlineHaystack(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(' | ').toLowerCase()
}
