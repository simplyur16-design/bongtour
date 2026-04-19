'use client'

import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import TopMegaMenu from '@/components/top-nav/TopMegaMenu'
import OverseasSubNavLinksRow, { OverseasSubNavMobileScrollRow } from '@/components/top-nav/OverseasSubNavLinksRow'

/**
 * 해외여행 서브메인 전용 — 전역 Header 1차 네비와 별개.
 * - hub: 여행상품 hover 시 권역/국가/도시 메가메뉴 ( `/travel/overseas` 만 )
 * - links: 우리끼리·항공+호텔·E-sim 등 — 권역 UI 없이 소메뉴만
 */
export default function OverseasTravelSubMainNav({ variant = 'hub' }: { variant?: 'hub' | 'links' }) {
  if (variant === 'links') {
    return (
      <div
        className="border-y border-bt-border-soft bg-slate-50 shadow-sm"
        aria-label="해외여행 하위 메뉴"
      >
        <div className={SITE_CONTENT_CLASS}>
          <div className="hidden lg:block lg:py-2">
            <OverseasSubNavLinksRow />
          </div>
          <div className="py-2 lg:hidden">
            <OverseasSubNavMobileScrollRow />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="border-y border-bt-border-soft bg-slate-50 shadow-sm"
      aria-label="해외여행 탐색 메뉴"
    >
      <div className={SITE_CONTENT_CLASS}>
        <div className="hidden lg:block lg:py-2">
          <TopMegaMenu />
        </div>

        <div className="lg:hidden">
          <div className="pb-2 pt-1">
            <OverseasSubNavMobileScrollRow />
          </div>
        </div>
      </div>
    </div>
  )
}
