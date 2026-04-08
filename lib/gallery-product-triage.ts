import type { GalleryProduct } from '@/app/api/gallery/route'

/** 메인 탭: 국내 / 해외 패키지 / 자유·에어텔 (API 필터 없이 제목 휴리스틱) */
export type ProductPickTab = 'domestic' | 'overseas_package' | 'freeform'

/** `제주(?!오후)` — `#제주오후` 등 태그만 있고 실제 제주 상품이 아닌 경우 해외 목록에서 빠지는 오분류 방지 */
const DOMESTIC_RE =
  /국내|제주(?!오후)|부산|경주|강릉|속초|서울|인천|대구|광주|전주|여수|남해|통영|거제|설악|지리산|한라|내륙|당일|1박2일|2박3일\s*국내/i

const FREEFORM_RE =
  /에어텔|자유여행|자유\s*일정|항공\s*\+\s*호텔|항공\+호텔|맞춤\s*항공|티켓\s*\+\s*호텔|FIT|개별\s*여행/i

/**
 * 공급사 상품명 기준 분류. DB/API 변경 없이 메인 탭용.
 * 애매하면 해외 패키지로 보냄(해외 상품 풀이 더 큰 경우가 많음).
 */
export function triageProductTitleForPickTab(title: string): ProductPickTab {
  if (!title || title.trim() === '') return 'overseas_package'
  if (DOMESTIC_RE.test(title)) return 'domestic'
  if (FREEFORM_RE.test(title)) return 'freeform'
  return 'overseas_package'
}

export function partitionGalleryByTab(items: GalleryProduct[]): Record<ProductPickTab, GalleryProduct[]> {
  const out: Record<ProductPickTab, GalleryProduct[]> = {
    domestic: [],
    overseas_package: [],
    freeform: [],
  }
  for (const p of items) {
    out[triageProductTitleForPickTab(p.title)].push(p)
  }
  return out
}

export function pickTabLabel(tab: ProductPickTab): string {
  switch (tab) {
    case 'domestic':
      return '국내'
    case 'overseas_package':
      return '해외 패키지'
    case 'freeform':
      return '자유·에어텔'
    default:
      return tab
  }
}

/** 카드 본문 보조 배지용 — 「해외」 중복 없이 짧게 */
export function productTypeShortLabel(tab: ProductPickTab): string {
  switch (tab) {
    case 'domestic':
      return '국내'
    case 'overseas_package':
      return '패키지'
    case 'freeform':
      return '자유·에어텔'
    default:
      return ''
  }
}
