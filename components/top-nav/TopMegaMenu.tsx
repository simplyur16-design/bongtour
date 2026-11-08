'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProductBrowseType } from '@/lib/products-browse-filter'
import { TOP_NAV_MEGA_REGIONS } from '@/lib/top-nav-resolve'
import OverseasMegaMenuHoverTrigger from '@/components/top-nav/OverseasMegaMenuHoverTrigger'
import RegionHoverTabs from '@/components/top-nav/RegionHoverTabs'
import CountryCityMegaPanel from '@/components/top-nav/CountryCityMegaPanel'
import { useVisibleMegaMenuRegions } from '@/components/top-nav/use-local-departure-tab-visibility'
import {
  decideMegaMenu,
  matchesFineHover,
  pointerTypeFromEvent,
  type MegaGesturePointer,
  type MegaMenuEvent,
} from '@/lib/mega-menu-interaction'

const CLOSE_DELAY_MS = 220

export default function TopMegaMenu() {
  /** 여행상품 메가메뉴 링크는 항상 패키지형( travel ) 기준 목적지 URL */
  const megaBrowseType: ProductBrowseType = 'travel'
  const [activeRegionId, setActiveRegionId] = useState<string | null>(TOP_NAV_MEGA_REGIONS[0]?.id ?? null)
  const [isMegaMenuOpen, setMegaMenuOpen] = useState(false)
  // REGRESSION-FREEZE[local-departure-display-prefix]: 제주출발 탭 ≥1건일 때만 — manifest
  const visibleRegions = useVisibleMegaMenuRegions(TOP_NAV_MEGA_REGIONS)

  const openTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const gestureRef = useRef<MegaGesturePointer>(null)
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

  const fineHoverNow = () =>
    matchesFineHover(typeof window === 'undefined' ? undefined : (query) => window.matchMedia(query))

  const dispatchMega = (event: MegaMenuEvent) => {
    const decision = decideMegaMenu(gestureRef.current, event)
    gestureRef.current = decision.gesturePointer
    if (decision.effect === 'open') {
      clearClose()
      clearOpen()
      setMegaMenuOpen(true)
    } else if (decision.effect === 'toggle') {
      clearClose()
      clearOpen()
      setMegaMenuOpen((open) => !open)
    } else if (decision.effect === 'arm-close') {
      scheduleClose()
    }
  }

  const onSurfacePointerLeave = (event: { pointerType: string }) => {
    dispatchMega({
      kind: 'pointerleave',
      pointerType: pointerTypeFromEvent(event.pointerType),
      fineHover: fineHoverNow(),
    })
  }


  const onHoverRegion = useCallback((id: string) => {
    setActiveRegionId(id)
  }, [])

  // 지방출발 단일 링크 탭(부산/청주/대구) 클릭 시 패널 깜빡임 방지를 위해 즉시 닫기.
  const onPickLocalDepartureLink = useCallback(() => {
    clearOpen()
    clearClose()
    setMegaMenuOpen(false)
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
        onPointerLeave={onSurfacePointerLeave}
      >
        <div className="min-h-[3.1rem] w-full min-w-0 lg:min-h-[3.25rem]">
          <OverseasMegaMenuHoverTrigger expanded={isMegaMenuOpen} onDecide={dispatchMega} />
        </div>

        {isMegaMenuOpen && activeRegion && activeRegion.countryGroups && (
          <div
            className="absolute left-1/2 top-full z-[60] mt-0 w-screen max-w-none -translate-x-1/2 border border-slate-200 border-l-4 border-l-teal-600 bg-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.12)]"
            onMouseEnter={clearClose}
            onPointerLeave={onSurfacePointerLeave}
          >
            <RegionHoverTabs
              regions={visibleRegions}
              activeRegionId={activeRegion.id}
              onHoverRegion={onHoverRegion}
              onPickLocalDepartureLink={onPickLocalDepartureLink}
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
