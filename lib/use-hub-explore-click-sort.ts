'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  bumpHubExploreClick,
  HUB_EXPLORE_CLICK_RANK_LS_KEY,
  readHubExploreClickMap,
} from '@/lib/hub-explore-click-rank'
import { devWarnMobileHome } from '@/lib/mobile-home-dev-log'

/**
 * 가로 스크롤 탐색 행(지역·국가 카드 등) — 로컬 클릭 수 기준 정렬.
 * SSR·첫 페인트는 기본 순서(카운트 0), 마운트 후 localStorage 반영.
 */
export function useHubExploreClickSort<T>(
  items: readonly T[] | null | undefined,
  rankKey: (item: T) => string
): { ordered: T[]; noteClick: (item: T) => void; bumpId: (id: string) => void } {
  const [clickMap, setClickMap] = useState<Record<string, number>>({})

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      setClickMap(readHubExploreClickMap())
    } catch (e) {
      devWarnMobileHome('hub-explore-click-map', e)
      setClickMap({})
    }
    const onStorage = (e: StorageEvent) => {
      try {
        if (e.key === null || e.key === HUB_EXPLORE_CLICK_RANK_LS_KEY) {
          setClickMap(readHubExploreClickMap())
        }
      } catch (err) {
        devWarnMobileHome('hub-explore-storage', err)
      }
    }
    try {
      window.addEventListener('storage', onStorage)
    } catch (e) {
      devWarnMobileHome('hub-explore-storage-listen', e)
      return undefined
    }
    return () => {
      try {
        window.removeEventListener('storage', onStorage)
      } catch {
        /* ignore */
      }
    }
  }, [])

  const ordered = useMemo(() => {
    if (!items?.length) return []
    return [...items]
      .map((item, stableIndex) => ({ item, stableIndex }))
      .sort((x, y) => {
        const cx = clickMap[rankKey(x.item)] ?? 0
        const cy = clickMap[rankKey(y.item)] ?? 0
        if (cy !== cx) return cy - cx
        return x.stableIndex - y.stableIndex
      })
      .map((x) => x.item)
  }, [items, clickMap, rankKey])

  const bumpId = useCallback((id: string) => {
    if (!id) return
    bumpHubExploreClick(id)
    setClickMap((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
  }, [])

  const noteClick = useCallback(
    (item: T) => {
      bumpId(rankKey(item))
    },
    [bumpId, rankKey]
  )

  return { ordered, noteClick, bumpId }
}
