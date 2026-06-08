/**
 * 메인 `ProductResultCardsClient` grid 카드 SSOT
 * 해외·자유여행 허브 PC 스크롤 = 동일 `ProductResultCard` + 동일 4열 칸 폭
 */

/** 메인 홈·시즌 그리드 — `lg:grid-cols-4` */
export const MAIN_MENU_PRODUCT_CARD_GRID_CLASS = 'grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4'

/**
 * lg 4열 그리드 1칸 폭 — `lg:grid-cols-4` + `sm:gap-4`(3칸 간격 = 3rem)
 * 메인메뉴 그리드 셀과 허브 PC 가로 스크롤 카드 공통
 */
export const MAIN_MENU_PC_CARD_CELL_WIDTH_CLASS =
  'w-[calc((100%-3rem)/4)] shrink-0 snap-start'

/** PC 허브 — 카드 가로 스크롤 줄 (`lg+`) */
export const HUB_PC_CARD_ROW_CLASS =
  'flex flex-nowrap gap-3 overflow-x-auto overflow-y-visible overscroll-x-contain pb-1 snap-x snap-mandatory [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] sm:gap-4'

/** 모바일 허브 — 큰 카드 아래 작은 카드 가로 스크롤 줄 */
export const HUB_MOBILE_SMALL_CARD_ROW_CLASS =
  'flex flex-nowrap gap-3 overflow-x-auto overflow-y-visible overscroll-x-contain pb-1 snap-x snap-mandatory [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]'

/** 모바일 허브 — 한 화면 2장(메인 2열과 동일 폭) + 다음 카드 peek */
export const HUB_MOBILE_SMALL_CARD_CELL_WIDTH_CLASS =
  'w-[calc((100%-0.75rem)/2)] min-w-0 shrink-0 snap-start'
