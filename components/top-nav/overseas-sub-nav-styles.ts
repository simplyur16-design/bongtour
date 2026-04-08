/**
 * 해외여행 소메뉴 4버튼 공통 스타일 — LinksRow / MobileScroll / HubRow 동일 시스템
 * hover는 duration-75로 즉시에 가깝게 반응, active는 현재 경로만
 */
import type { OverseasSubNavItem } from '@/components/top-nav/overseas-sub-nav-items'

export const overseasSubNavTabBase =
  'inline-flex min-h-[2.75rem] w-full max-w-none items-center justify-center rounded-lg border px-2 py-2.5 text-center text-[12px] leading-snug tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow] duration-75 ease-out [text-wrap:balance] sm:px-2.5 sm:text-[13px] md:text-[14px] lg:px-3 lg:text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2'

/** 비활성: 기본 박스 통일 + 호버 시 틸 계열로 즉시 전환 */
export const overseasSubNavTabIdle =
  `${overseasSubNavTabBase} border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:border-teal-400 hover:bg-teal-50 hover:text-teal-900`

/** 현재 페이지만 — 4버튼 동일 active 톤 */
export const overseasSubNavTabActive =
  `${overseasSubNavTabBase} border-teal-500 bg-teal-50 font-semibold text-teal-900 shadow-sm ring-1 ring-inset ring-teal-500/20`

export function isOverseasSubNavHrefActive(pathname: string, href: string): boolean {
  const path = href.split('?')[0] ?? href
  if (path === '/travel/overseas') return pathname === '/travel/overseas'
  if (path === '/travel/air-hotel') return pathname === '/travel/air-hotel'
  return pathname === path || pathname.startsWith(`${path}/`)
}

export function hrefForOverseasSubNavItem(item: OverseasSubNavItem): string {
  if (item.kind === 'mega') return '/travel/overseas'
  return item.href
}
