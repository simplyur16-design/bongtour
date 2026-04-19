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

type Props = {
  onHoverMegaEnter: () => void
  onFocusMega: () => void
  /** 링크 항목 호버 시 메가 패널 닫기 */
  onHoverLinkEnter: () => void
}

/**
 * 해외여행 허브 상단 — 여행상품은 버튼(메가 열림), 나머지는 링크.
 * 여행상품(mega)은 시각적으로 항상 idle(호버 시에만 틸), 현재 경로는 aria로만 표시.
 */
export default function OverseasSubNavHubRow({ onHoverMegaEnter, onFocusMega, onHoverLinkEnter }: Props) {
  const pathname = usePathname() ?? ''

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-x-3 md:gap-x-4 lg:gap-x-5"
      role="tablist"
      aria-label="해외여행 하위 메뉴"
    >
      {OVERSEAS_SUB_NAV_ITEMS.map((item) => {
        const href = hrefForOverseasSubNavItem(item)
        const cell = 'min-w-0 sm:flex-1 sm:basis-0'
        if (item.kind === 'mega') {
          const travelHubActive = pathname === '/travel/overseas'
          return (
            <div key={item.label} className={cell}>
              <button
                type="button"
                role="tab"
                aria-selected={travelHubActive}
                aria-current={travelHubActive ? 'page' : undefined}
                className={overseasSubNavTabIdle}
                onMouseEnter={onHoverMegaEnter}
                onFocus={onFocusMega}
              >
                {item.label}
              </button>
            </div>
          )
        }
        const linkActive = isOverseasSubNavHrefActive(pathname, href)
        return (
          <div key={item.href} className={cell}>
            <Link
              href={href}
              className={linkActive ? overseasSubNavTabActive : overseasSubNavTabIdle}
              aria-current={linkActive ? 'page' : undefined}
              onMouseEnter={onHoverLinkEnter}
            >
              {item.label}
            </Link>
          </div>
        )
      })}
    </div>
  )
}
