import type { OverseasSupplierKey } from '@/lib/normalize-supplier-origin'
import type { TravelLandingSupplierPickId } from '@/lib/travel-landing-supplier-chips'
import {
  buildOverseasProductMatchHaystack,
  type OverseasProductMatchInput,
} from '@/lib/match-overseas-product'

/** 해외 랜딩 상단 검색 상태 */
export type OverseasLandingSearchState = {
  /** 목적지·상품명 자유 검색 */
  q: string
  /** 출발일 (YYYY-MM-DD, 빈 문자열이면 미적용) */
  departDate: string
  /** 출발지 (향후 항공/지역 필터 연동용, 현재는 표시·상태만) */
  departFrom: string
  /** all | 패키지 | 자유·에어텔 */
  travelType: 'all' | 'package' | 'free'
  /** 검색바에서 고른 공급사 — null 이면 탭 공급사만 반영 */
  supplierPick: TravelLandingSupplierPickId | null
  priceMin: string
  priceMax: string
  sort: 'default' | 'price_asc' | 'price_desc' | 'date_asc'
  /** 빠른 필터 칩 id */
  quickIds: string[]
}

export const OVERSEAS_LANDING_SEARCH_INITIAL: OverseasLandingSearchState = {
  q: '',
  departDate: '',
  departFrom: '',
  travelType: 'all',
  supplierPick: null,
  priceMin: '',
  priceMax: '',
  sort: 'default',
  quickIds: [],
}

/** 빠른 필터: 토큰은 목적지 매칭과 동일 haystack 부분일치 */
export const OVERSEAS_QUICK_FILTER_CHIPS: { id: string; label: string; terms: string[] }[] = [
  { id: 'popular', label: '인기·특가', terms: ['인기', '특가', '베스트', '프로모'] },
  { id: 'spring', label: '봄 여행', terms: ['봄', '벚꽃', 'spring'] },
  { id: 'family', label: '가족', terms: ['가족', '패밀리', 'Family'] },
  { id: 'freehint', label: '자유·에어텔', terms: ['자유', '에어텔', '항공', '호텔'] },
  { id: '3n4d', label: '3박4일', terms: ['3박4일', '3박 4일'] },
  { id: 'confirmed', label: '출발확정', terms: ['출발확정', '출발 확정', '확정'] },
]

export function overseasQuickTermsFromIds(ids: string[]): string[] {
  const terms: string[] = []
  for (const id of ids) {
    const row = OVERSEAS_QUICK_FILTER_CHIPS.find((c) => c.id === id)
    if (row) terms.push(...row.terms)
  }
  return terms
}

/** 선택된 빠른 칩마다(칩 내부 용어는 OR) 모두 만족(AND) */
export function productMatchesOverseasQuickChipIds(
  product: OverseasProductMatchInput,
  ids: string[]
): boolean {
  if (ids.length === 0) return true
  const haystack = buildOverseasProductMatchHaystack(product)
  for (const id of ids) {
    const row = OVERSEAS_QUICK_FILTER_CHIPS.find((c) => c.id === id)
    if (!row) continue
    const hit = row.terms.some((t) => haystack.includes(t.trim().toLowerCase()))
    if (!hit) return false
  }
  return true
}

export function supplierKeyFromLandingPick(id: TravelLandingSupplierPickId | null): OverseasSupplierKey | undefined {
  if (!id || id === 'all') return undefined
  const map: Record<string, OverseasSupplierKey> = {
    hana: 'hanatour',
    modu: 'modetour',
    johan: 'verygoodtour',
    yellow: 'ybtour',
    etc: 'etc',
  }
  return map[id]
}
