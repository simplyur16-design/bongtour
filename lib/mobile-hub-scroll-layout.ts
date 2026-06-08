/**
 * 모바일 허브 가로 스크롤·권역 섹션 스택 SSOT.
 * - 해외·자유여행 상품: compact 카드 한 줄 가로 스크롤(드래그) + 다음 카드 peek
 * - 세로: 섹션 간격 축소 → 다음 권역 제목이 화면 하단에 peek
 */

/** compact 카드 — 모바일 가로 스크롤 한 줄(해외·자유여행·홈 시즌 등) */
export const MOBILE_HUB_COMPACT_CARD_WIDTH_CLASS =
  'w-[min(11rem,calc((100vw-2.75rem)*0.43))] shrink-0 snap-start'

/** 권역/국가 섹션 세로 스택 — 모바일에서 다음 h2 peek */
export const MOBILE_HUB_SECTION_STACK_CLASS = 'max-md:space-y-5 md:space-y-10'

/** 해외 허브 권역 블록 세로 스택 */
export const MOBILE_HUB_OVERSEAS_SECTION_STACK_CLASS = 'max-md:space-y-5 md:space-y-12'

/** 가로 스크롤 줄 — 스크롤 컨테이너 본문(마진 없음) */
export const MOBILE_HUB_PRODUCT_ROW_SCROLL_CLASS =
  'flex flex-nowrap gap-3 overflow-x-auto overflow-y-visible overscroll-x-contain px-0 pb-1 pt-0.5 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:thin] [-webkit-overflow-scrolling:touch] max-md:-mx-1 md:gap-4 md:pb-2'

/** 가로 스크롤 줄 공통 (모바일·데스크톱) */
export const MOBILE_HUB_PRODUCT_ROW_CLASS = `mt-6 ${MOBILE_HUB_PRODUCT_ROW_SCROLL_CLASS}`
