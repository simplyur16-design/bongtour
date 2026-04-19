'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProductBrowseType } from '@/lib/products-browse-filter'
import { TOP_NAV_MEGA_REGIONS } from '@/lib/top-nav-resolve'
import OverseasSubNavHubRow from '@/components/top-nav/OverseasSubNavHubRow'
import RegionHoverTabs from '@/components/top-nav/RegionHoverTabs'
import CountryCityMegaPanel from '@/components/top-nav/CountryCityMegaPanel'

const CLOSE_DELAY_MS = 220

export default function TopMegaMenu() {
  /** 여행상품 메가메뉴 링크는 항상 패키지형( travel ) 기준 목적지 URL */
  const megaBrowseType: ProductBrowseType = 'travel'
  const [activeRegionId, setActiveRegionId] = useState<string | null>(TOP_NAV_MEGA_REGIONS[0]?.id ?? null)
  const [isMegaMenuOpen, setMegaMenuOpen] = useState(false)

  const openTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const navRef = useRef<HTMLDivElement>(null)

  const clearOpen = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
  }
  const clearClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const scheduleClose = () => {
    clearOpen()
    clearClose()
    closeTimerRef.current = window.setTimeout(() => setMegaMenuOpen(false), CLOSE_DELAY_MS)
  }

  const onHoverMegaEnter = useCallback(() => {
    clearClose()
    clearOpen()
    setMegaMenuOpen(true)
  }, [])

  const onFocusMega = useCallback(() => {
    clearClose()
    clearOpen()
    setMegaMenuOpen(true)
  }, [])


  const onHoverRegion = useCallback((id: string) => {
    setActiveRegionId(id)
  }, [])

  useEffect(() => {
    return () => {
      clearOpen()
      clearClose()
    }
  }, [])

  const activeRegion = TOP_NAV_MEGA_REGIONS.find((r) => r.id === activeRegionId) ?? TOP_NAV_MEGA_REGIONS[0]

  return (
    <div ref={navRef} className="relative w-full">
      <div
        className="flex w-full flex-col items-stretch"
        onMouseLeave={scheduleClose}
      >
        <div className="min-h-[3.1rem] w-full min-w-0 lg:min-h-[3.25rem]">
          <OverseasSubNavHubRow
            onHoverMegaEnter={onHoverMegaEnter}
            onFocusMega={onFocusMega}
            onHoverLinkEnter={scheduleClose}
          />
        </div>

        {isMegaMenuOpen && activeRegion && activeRegion.countryGroups && (
          <div
            className="absolute left-1/2 top-full z-[60] mt-0 w-screen max-w-none -translate-x-1/2 border border-slate-200 border-l-4 border-l-teal-600 bg-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.12)]"
            onMouseEnter={clearClose}
            onMouseLeave={scheduleClose}
          >
            <RegionHoverTabs
              regions={TOP_NAV_MEGA_REGIONS}
              activeRegionId={activeRegion.id}
              onHoverRegion={onHoverRegion}
            />
            <CountryCityMegaPanel
              regionId={activeRegion.id}
              countryGroups={activeRegion.countryGroups}
              activeProductType={megaBrowseType}
            />
          </div>
        )}
      </div>
    </div>
  )
}
