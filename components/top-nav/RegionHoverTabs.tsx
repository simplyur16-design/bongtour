'use client'

import type { MouseEvent } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { MegaMenuRegion } from '@/lib/travel-landing-mega-menu-data'
import {
  isOnOverseasHubPage,
  navigateOverseasHubRegionClient,
  OVERSEAS_HUB_PATH,
} from '@/lib/overseas-hub-client-nav'
import { prefetchPropForHref } from '@/lib/route-prefetch-policy'
import { buildProductsHrefRegionOnly } from '@/lib/top-nav-resolve'
import HorizontalScrollWithArrows from '@/components/ui/HorizontalScrollWithArrows'

type Props = {
  regions: MegaMenuRegion[]
  activeRegionId: string | null
  onHoverRegion: (id: string) => void
  /** 단일 링크(지방출발) 탭 클릭 시 호출 — TopMegaMenu 가 패널을 즉시 닫는다 (잠시라도 깜빡 안 뜨게). */
  onPickLocalDepartureLink?: () => void
}

const TAB_BASE_CLASS =
  'shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-center text-[14px] font-medium sm:px-3.5'
const TAB_ACTIVE_CLASS = `${TAB_BASE_CLASS} border-orange-500 bg-white text-orange-500`
const TAB_IDLE_CLASS = `${TAB_BASE_CLASS} border-transparent text-slate-600 transition hover:border-slate-300 hover:text-slate-800`

const TAB_ROW_CLASS =
  'mx-auto flex w-full max-w-6xl flex-nowrap items-stretch justify-center gap-0 overflow-x-auto px-2 py-0 text-center [-ms-overflow-style:none] [scrollbar-width:none] sm:px-3 [&::-webkit-scrollbar]:hidden'

export default function RegionHoverTabs({
  regions,
  activeRegionId,
  onHoverRegion,
  onPickLocalDepartureLink,
}: Props) {
  const pathname = usePathname()
  const onOverseasHub = pathname === OVERSEAS_HUB_PATH || isOnOverseasHubPage()

  return (
    <div className="border-b border-slate-200 bg-white">
      <HorizontalScrollWithArrows
        as="div"
        scrollClassName={TAB_ROW_CLASS}
        scrollRole="tablist"
        ariaLabel="권역"
        scrollRatio={0.75}
      >
        {regions.map((r) => {
          const active = activeRegionId === r.id
          const className = active ? TAB_ACTIVE_CLASS : TAB_IDLE_CLASS
          const href = buildProductsHrefRegionOnly({ regionId: r.id })
          const onRegionTabClick = (e: MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault()
            if (onOverseasHub) {
              navigateOverseasHubRegionClient(href)
            } else {
              window.location.assign(href)
            }
            onPickLocalDepartureLink?.()
          }

          const tabProps = {
            role: 'tab' as const,
            'aria-selected': active,
            className,
            onMouseEnter: () => onHoverRegion(r.id),
            onFocus: () => onHoverRegion(r.id),
            onClick: onRegionTabClick,
          }

          if (onOverseasHub) {
            return (
              <a key={r.id} href={href} {...tabProps}>
                {r.label}
              </a>
            )
          }

          if (r.localDeparture) {
            return (
              <Link key={r.id} href={href} prefetch={prefetchPropForHref(href)} {...tabProps}>
                {r.label}
              </Link>
            )
          }
          return (
            <Link key={r.id} href={href} prefetch={prefetchPropForHref(href)} {...tabProps}>
              {r.label}
            </Link>
          )
        })}
      </HorizontalScrollWithArrows>
    </div>
  )
}
