'use client'

import { useEffect, useState } from 'react'
import type { ItineraryDayRow } from '../_types'

/** GET `/api/admin/products/[id]/itinerary-days` — id가 바뀔 때만 자동 로드. */
export function useItineraryDays(productId: string | null): ItineraryDayRow[] | null {
  const [itineraryDays, setItineraryDays] = useState<ItineraryDayRow[] | null>(null)
  useEffect(() => {
    if (!productId) return
    fetch(`/api/admin/products/${productId}/itinerary-days`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ItineraryDayRow[]) => setItineraryDays(Array.isArray(data) ? data : []))
      .catch(() => setItineraryDays([]))
  }, [productId])
  return itineraryDays
}
