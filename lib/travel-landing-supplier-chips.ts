import type { OverseasSupplierKey } from '@/lib/normalize-supplier-origin'

/** 해외·국내 랜딩 공통 공급사 칩 id */
export type TravelLandingSupplierPickId = 'all' | 'hana' | 'modu' | 'johan' | 'yellow' | 'etc'

export const TRAVEL_LANDING_SUPPLIER_CHIPS: {
  id: TravelLandingSupplierPickId
  label: string
  key: OverseasSupplierKey | null
}[] = [
  { id: 'all', label: '전체 공급사', key: null },
  { id: 'hana', label: '하나투어', key: 'hanatour' },
  { id: 'modu', label: '모두투어', key: 'modetour' },
  { id: 'johan', label: '참좋은여행사', key: 'verygoodtour' },
  { id: 'yellow', label: '노랑풍선', key: 'ybtour' },
  { id: 'etc', label: '기타', key: 'etc' },
]

export function travelLandingSupplierLabel(id: TravelLandingSupplierPickId): string {
  return TRAVEL_LANDING_SUPPLIER_CHIPS.find((c) => c.id === id)?.label ?? ''
}
