/**
 * 항공사 필터 — 내부 코드 ↔ 표시명.
 * 실제 매칭은 `product.airline`·`ProductDeparture.carrierName` 문자열과 정규화 후 비교.
 * REGRESSION-FREEZE[airline-compare-canonical-1120]: 카탈로그 밖 항공사는 기타 한 덩어리가 아니라 고정 테이블 이름별 필터 — manifest
 */
import { canonicalPublicAirlineLabel } from '@/lib/airline-variant-group'
export type AirlineCatalogEntry = {
  code: string
  label: string
  /** 소문자 토큰: 매칭용 */
  matchTokens: string[]
}

/** UI 고정 순서. 표에 없는 항공사는 `airlineFacetBuckets`가 고정 테이블 이름으로 따로 낸다. */
export const AIRLINE_CATALOG: AirlineCatalogEntry[] = [
  { code: 'korean-air', label: '대한항공', matchTokens: ['대한항공', 'korean air', 'ke', 'korean'] },
  { code: 'asiana', label: '아시아나항공', matchTokens: ['아시아나', 'asiana', 'oz'] },
  { code: 'airbusan', label: '에어부산', matchTokens: ['에어부산', 'air busan', 'bx'] },
  { code: 'air-seoul', label: '에어서울', matchTokens: ['에어서울', 'air seoul', 'rs'] },
  { code: 'airok', label: '에어로케이', matchTokens: ['에어로케이', 'airok', 'rf'] },
  { code: 'eastar', label: '이스타항공', matchTokens: ['이스타', 'eastar', 'ze'] },
  { code: 'jeju-air', label: '제주항공', matchTokens: ['제주항공', '제주에어', 'jeju air', '7c'] },
  { code: 'jin-air', label: '진에어', matchTokens: ['진에어', 'jin air', 'lj'] },
  // REGRESSION-FREEZE[airline-tway-to-trinity]: catalog label Trinity — manifest
  {
    code: 'tway',
    label: '트리니티항공',
    matchTokens: ['트리니티', 'trinity', '티웨이', 'tway', "t'way", 'tw'],
  },
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

export type AirlineFacetBucket = { code: string; label: string }

/** 원문 항공사 문자열 → 비교에 쓰는 버킷. 같은 항공사(띄어쓰기·코드)는 한 버킷. 표에 없으면 이름을 그대로 둔다. */
export function airlineFacetBuckets(parts: (string | null | undefined)[]): AirlineFacetBucket[] {
  const seen = new Set<string>()
  const out: AirlineFacetBucket[] = []
  for (const part of parts) {
    const label = canonicalPublicAirlineLabel(part)
    if (!label) continue
    let bucket: AirlineFacetBucket = { code: label, label }
    for (const e of AIRLINE_CATALOG) {
      if (airlineStringMatchesCode(label, e.code)) {
        bucket = { code: e.code, label: e.label }
        break
      }
    }
    if (seen.has(bucket.code)) continue
    seen.add(bucket.code)
    out.push(bucket)
  }
  return out
}

/** 필터 코드 하나. `other` = 항공 문자는 있으나 항공사명으로 확정되지 않은 경우. */
export function airlinePartsMatchCode(parts: (string | null | undefined)[], code: string): boolean {
  const buckets = airlineFacetBuckets(parts)
  if (code === 'other') {
    const hasText = parts.some((p) => String(p ?? '').trim())
    return hasText && buckets.length === 0
  }
  if (buckets.some((b) => b.code === code)) return true
  const hay = buildAirlineHaystack(parts)
  return airlineStringMatchesCode(hay, code)
}
