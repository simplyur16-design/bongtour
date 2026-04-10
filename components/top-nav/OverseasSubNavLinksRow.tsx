'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { OVERSEAS_SUB_NAV_ITEMS } from '@/components/top-nav/overseas-sub-nav-items'
import {
  hrefForOverseasSubNavItem,
  isOverseasSubNavHrefActive,
  overseasSubNavTabActive,
  overseasSubNavTabIdle,
} from '@/components/top-nav/overseas-sub-nav-styles'
import type { OverseasSubNavItem } from '@/components/top-nav/overseas-sub-nav-items'

export { hrefForOverseasSubNavItem } from '@/components/top-nav/overseas-sub-nav-styles'

function OverseasSubNavLinkLabel({ item }: { item: OverseasSubNavItem }) {
  if (item.kind === 'link' && item.labelLines) {
    return (
      <span className="flex flex-col items-center justify-center gap-0.5 leading-tight">
        <span>{item.labelLines[0]}</span>
        <span>{item.labelLines[1]}</span>
      </span>
    )
  }
  return item.label
}

/**
 * 해외여행 전용 하위 페이지 — 권역/국가 메가메뉴 없이 동일 4개 링크만 표시
 */
export default function OverseasSubNavLinksRow() {
  const pathname = usePathname()

  return (
    <div
      className="grid w-full min-w-0 grid-cols-2 gap-x-2 gap-y-2 sm:grid-cols-4 sm:gap-x-3 md:gap-x-4 lg:gap-x-5"
      role="navigation"
      aria-label="해외여행 하위 메뉴"
    >
      {OVERSEAS_SUB_NAV_ITEMS.map((item) => {
        const href = hrefForOverseasSubNavItem(item)
        const pathActive = isOverseasSubNavHrefActive(pathname, href)
        /** 여행상품은 기본·호버만 (항상 올라온 active 톤 제거), 나머지는 현재 경로만 active */
        const showActiveStyle = item.kind !== 'mega' && pathActive
        return (
          <Link
            key={href}
            href={href}
            className={showActiveStyle ? overseasSubNavTabActive : overseasSubNavTabIdle}
            aria-current={pathActive ? 'page' : undefined}
            aria-label={item.kind === 'link' && item.labelLines ? item.label : undefined}
          >
            <OverseasSubNavLinkLabel item={item} />
          </Link>
        )
      })}
    </div>
  )
}

/**
 * 좁은 화면: 4개 소메뉴를 한 줄에 동시 노출.
 * (이전: flex + 탭 공통 `w-full` 때문에 각 항목이 뷰포트 전체 너비를 차지해 첫 탭만 보이는 문제가 있었음)
 */
export function OverseasSubNavMobileScrollRow() {
  const pathname = usePathname()

  return (
    <div
      className="grid w-full min-w-0 grid-cols-4 gap-1 pb-2 pt-1 sm:gap-1.5"
      role="navigation"
      aria-label="해외여행 하위 메뉴"
    >
      {OVERSEAS_SUB_NAV_ITEMS.map((item) => {
        const href = hrefForOverseasSubNavItem(item)
        const pathActive = isOverseasSubNavHrefActive(pathname, href)
        const showActiveStyle = item.kind !== 'mega' && pathActive
        return (
          <Link
            key={href}
            href={href}
            className={`${
              showActiveStyle ? overseasSubNavTabActive : overseasSubNavTabIdle
            } min-h-[3rem] min-w-0 max-w-none touch-manipulation whitespace-normal px-1 py-2 text-[10px] leading-snug [-webkit-tap-highlight-color:transparent] active:opacity-[0.92] sm:min-h-[2.75rem] sm:px-1.5 sm:text-[11px] md:text-[12px]`}
            aria-current={pathActive ? 'page' : undefined}
            aria-label={item.kind === 'link' && item.labelLines ? item.label : undefined}
          >
            <OverseasSubNavLinkLabel item={item} />
          </Link>
        )
      })}
    </div>
  )
}
