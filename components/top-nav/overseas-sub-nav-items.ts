import type { ProductBrowseType } from '@/lib/products-browse-filter'

/**
 * 해외여행 서브메인 상단 소메뉴 데이터 — `OverseasSubNavLinksRow`·모바일 스크롤 행에서 사용.
 * PC 허브 메가 열기 트리거는 `OverseasMegaMenuHoverTrigger` + `TopMegaMenu` (헤더 1차와 중복 3탭 제거).
 */
export type OverseasSubNavItem =
  | { kind: 'mega'; browseType: ProductBrowseType; label: string }
  | {
      kind: 'link'
      href: string
      /** 접근성·스크린리더용 전체 문구 */
      label: string
      /** 좁은 그리드에서 두 줄로 나눠 표시(선택) */
      labelLines?: readonly [string, string]
    }

export const OVERSEAS_SUB_NAV_ITEMS: OverseasSubNavItem[] = [
  { kind: 'mega', browseType: 'travel', label: '여행상품' },
  { kind: 'link', href: '/travel/overseas/private-trip', label: '우리끼리' },
  { kind: 'link', href: '/travel/air-hotel?scope=overseas&type=airtel', label: '항공+호텔' },
]
