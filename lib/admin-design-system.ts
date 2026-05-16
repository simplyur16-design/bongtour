/**
 * PR-G 어드민 디자인 시스템 SSOT (메모리 #29)
 * - 사이드바: #1F1B2D (bt-text-navy)
 * - 메인: #EFEDF8 (bt-bg-lavender)
 * - 카드: 흰 배경 + 0.5px border + rounded-xl
 * - CTA: 골드 #d9a81e (bt-brand-gold-strong)
 */

/** 어드민 루트 셸 — layout 최상위 */
export const ADMIN_SHELL_CLASS = 'admin-shell flex min-h-screen font-sans text-bt-body'

/** 사이드바 */
export const ADMIN_SIDEBAR_CLASS =
  'flex shrink-0 flex-col border-r border-white/10 bg-bt-text-navy text-white transition-[width] duration-200'

export const ADMIN_SIDEBAR_HEADER_CLASS =
  'flex h-14 items-center justify-between border-b border-white/10 px-3'

export const ADMIN_NAV_ACTIVE_CLASS =
  'bg-white/10 text-bt-brand-gold border-l-2 border-bt-brand-gold-strong pl-[10px]'

export const ADMIN_NAV_IDLE_CLASS =
  'text-white/70 hover:bg-white/10 hover:text-white border-l-2 border-transparent pl-[10px]'

/** 메인 콘텐츠 */
export const ADMIN_MAIN_CLASS =
  'admin-main flex-1 min-h-screen overflow-auto bg-bt-bg-lavender px-4 pb-8 pt-4 sm:px-6'

/** 카드 */
export const ADMIN_CARD_CLASS =
  'rounded-xl border-[0.5px] border-bt-border-soft bg-white p-5 shadow-sm'

export const ADMIN_CARD_HOVER_CLASS =
  'transition hover:border-bt-text-navy/20 hover:shadow-md'

/** 페이지 헤더 */
export const ADMIN_PAGE_TITLE_CLASS = 'text-3xl font-bold tracking-tight text-bt-text-navy'

export const ADMIN_PAGE_SUBTITLE_CLASS = 'bt-wrap mt-2 text-sm text-bt-text-muted-lavender'

export const ADMIN_SECTION_TITLE_CLASS =
  'mb-4 border-l-4 border-bt-brand-gold-strong pl-4 text-lg font-bold text-bt-text-navy'

/** CTA */
export const ADMIN_BTN_PRIMARY_CLASS =
  'inline-flex items-center justify-center rounded-lg bg-bt-brand-gold-strong px-4 py-2.5 text-sm font-semibold text-bt-text-navy transition hover:bg-bt-brand-gold'

export const ADMIN_BTN_SECONDARY_CLASS =
  'inline-flex items-center justify-center rounded-lg border-[0.5px] border-bt-text-navy/30 bg-white px-4 py-2.5 text-sm font-medium text-bt-text-navy transition hover:bg-bt-bg-lavender-soft'

/** 테이블 래퍼 (overflow scroll 영역) */
export const ADMIN_TABLE_WRAP_CLASS =
  'overflow-x-auto rounded-xl border-[0.5px] border-bt-border-soft bg-white shadow-sm'
