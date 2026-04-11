import type { ProductBrowseType } from '@/lib/products-browse-filter'

/**
 * 해외여행 서브메인 상단 소메뉴 — 메인 헤더 1차 네비와 별개.
 * - 여행상품: 권역/국가/도시 메가메뉴(TopMegaMenu)와 연동
 * - 나머지: 전용 페이지로 이동 (탐색형 권역 UI 없음)
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
  { kind: 'link', href: '/travel/overseas/private-trip', label: '우리여행' },
  {
    kind: 'link',
    href: '/travel/air-hotel?scope=overseas&type=airtel',
    label: '항공+호텔 (자유여행)',
    labelLines: ['항공+호텔', '(자유여행)'],
  },
  { kind: 'link', href: '/travel/esim', label: 'E-sim' },
]
