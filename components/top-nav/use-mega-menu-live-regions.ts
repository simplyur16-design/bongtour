'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MegaMenuRegion } from '@/lib/travel-landing-mega-menu-data'
import { arrangeMegaMenuRegionsByCounts, type MegaMenuLiveCounts } from '@/lib/mega-menu-live-menu'

/** 탭 열 때마다 다시 받지 않게 페이지 단위로 한 번만 */
let countsPromise: Promise<MegaMenuLiveCounts | null> | null = null

function loadCounts(): Promise<MegaMenuLiveCounts | null> {
  if (!countsPromise) {
    countsPromise = fetch('/api/mega-menu/counts')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { counts?: MegaMenuLiveCounts | null } | null) =>
        j && j.counts && typeof j.counts === 'object' ? j.counts : null,
      )
      .catch(() => null)
  }
  return countsPromise
}

/**
 * 메가메뉴 자동 정리 — 상품 0인 탭·중분류·도시 숨김, 많은 순 정렬. 수를 받기 전·실패 시 원래 메뉴.
 * REGRESSION-FREEZE[mega-menu-live-auto-1122]: 클라이언트 자동 정리 훅 — manifest
 */
export function useMegaMenuLiveRegions(regions: ReadonlyArray<MegaMenuRegion>): MegaMenuRegion[] {
  const [counts, setCounts] = useState<MegaMenuLiveCounts | null>(null)
  useEffect(() => {
    let alive = true
    void loadCounts().then((c) => {
      if (alive) setCounts(c)
    })
    return () => {
      alive = false
    }
  }, [])
  return useMemo(() => arrangeMegaMenuRegionsByCounts(regions, counts), [regions, counts])
}
