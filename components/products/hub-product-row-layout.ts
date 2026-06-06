/**
 * 해외·자유여행 허브 상품 행 — li 폭 SSOT.
 * Tailwind content 스캔용: 전체 클래스를 리터럴 문자열로 유지(템플릿 분리 금지).
 */

/** 권역 가로 스크롤 줄 — compact + md+ 고정 폭 */
export const HUB_PRODUCT_SCROLL_LI_CLASS =
  'w-[min(11rem,calc((100vw-2.75rem)*0.43))] shrink-0 snap-start md:w-[min(17.5rem,calc(100vw-2.75rem))] md:max-w-none lg:w-[calc((100%-2rem)/3)] lg:min-w-0 md:snap-align-none'

/** 해외 허브 wide — 4열 */
export const HUB_PRODUCT_SCROLL_LI_CLASS_WIDE =
  'w-[min(11rem,calc((100vw-2.75rem)*0.43))] shrink-0 snap-start md:w-[min(16.25rem,calc(100vw-2.5rem))] md:max-w-none lg:w-[calc((100%-3rem)/4)] lg:min-w-0 md:snap-align-none'

/** 국가 필터 플랫 목록 — 모바일 compact 가로줄 · md+ 그리드 auto */
export const HUB_PRODUCT_FLAT_LI_CLASS =
  'w-[min(11rem,calc((100vw-2.75rem)*0.43))] shrink-0 snap-start md:w-auto md:max-w-none md:shrink md:snap-align-none'
