'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  filterLocalDepartureTabsByCount,
  LOCAL_DEPARTURE_TABS_HIDDEN_WHEN_EMPTY,
  localDepartureTabCountUrl,
  type LocalDepartureTabCounts,
} from '@/lib/local-departure-tab-visibility'

let countsPromise: Promise<LocalDepartureTabCounts> | null = null

function loadLocalDepartureTabCounts(): Promise<LocalDepartureTabCounts> {
  if (!countsPromise) {
    countsPromise = Promise.all(
      LOCAL_DEPARTURE_TABS_HIDDEN_WHEN_EMPTY.map(async (tag) => {
        try {
          const res = await fetch(localDepartureTabCountUrl(tag), { cache: 'force-cache' })
          if (!res.ok) return [tag, 0] as const
          const j = (await res.json()) as { total?: unknown }
          return [tag, typeof j.total === 'number' ? j.total : 0] as const
        } catch {
          return [tag, 0] as const
        }
      }),
    ).then((pairs) => Object.fromEntries(pairs) as LocalDepartureTabCounts)
  }
  return countsPromise
}

/**
 * 메가메뉴 탭 목록 — 상품 0건 지방출발 탭(제주출발) 제외.
 * REGRESSION-FREEZE[local-departure-display-prefix]: jeju_dep ≥1건일 때만 — manifest
 */
export function useVisibleMegaMenuRegions<T extends { localDeparture?: string | null }>(regions: readonly T[]): T[] {
  const [counts, setCounts] = useState<LocalDepartureTabCounts>({})
  useEffect(() => {
    let alive = true
    void loadLocalDepartureTabCounts().then((c) => {
      if (alive) setCounts(c)
    })
    return () => {
      alive = false
    }
  }, [])
  return useMemo(() => filterLocalDepartureTabsByCount(regions, counts), [regions, counts])
}
