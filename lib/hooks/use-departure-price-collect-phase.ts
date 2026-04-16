'use client'

import { useEffect, useState } from 'react'
import { DEPARTURE_COLLECT_UI_DELAYED_AFTER_MS } from '@/lib/departure-price-collect-ui'

/**
 * `departureCollectOpen` 이 true인 동안만 타이머를 돌려 2단계(지연) UI로 전환한다.
 * 공급사별 수집 구현과 무관 — 표시용 단계만 담당.
 */
export function useDeparturePriceCollectPhase(isCollecting: boolean): {
  delayed: boolean
  phase: 'idle' | 'collecting' | 'delayed_collecting'
} {
  const [delayed, setDelayed] = useState(false)

  useEffect(() => {
    if (!isCollecting) {
      setDelayed(false)
      return
    }
    setDelayed(false)
    const id = window.setTimeout(() => setDelayed(true), DEPARTURE_COLLECT_UI_DELAYED_AFTER_MS)
    return () => window.clearTimeout(id)
  }, [isCollecting])

  const phase: 'idle' | 'collecting' | 'delayed_collecting' = !isCollecting
    ? 'idle'
    : delayed
      ? 'delayed_collecting'
      : 'collecting'

  return { delayed, phase }
}
