'use client'

import type { ReactNode } from 'react'
import type { ResultItem } from '@/components/products/ProductResultsList'
import {
  MOBILE_DEPARTURE_GROUP_LABEL,
  MOBILE_DEPARTURE_GROUP_ORDER,
  partitionByMobileDepartureGroup,
  type MobileDepartureGroup,
} from '@/lib/mobile-departure-group'

/**
 * 모바일 홈·검색 — 인천·김포 / 지방 / 미확인.
 * REGRESSION-FREEZE[mobile-departure-group-actual-airport]: missing airport is unknown — manifest
 */
export default function MobileDepartureGroupStack({
  items,
  renderItems,
}: {
  items: ResultItem[]
  renderItems: (items: ResultItem[], group: MobileDepartureGroup) => ReactNode
}) {
  const parts = partitionByMobileDepartureGroup(items)
  const visible = MOBILE_DEPARTURE_GROUP_ORDER.filter((group) => parts[group].length > 0)
  if (visible.length === 0) return null

  return (
    <div className="space-y-4">
      {visible.map((group) => (
        <section key={group} aria-label={MOBILE_DEPARTURE_GROUP_LABEL[group]}>
          <h3 className="text-sm font-bold leading-snug text-slate-900">{MOBILE_DEPARTURE_GROUP_LABEL[group]}</h3>
          {renderItems(parts[group], group)}
        </section>
      ))}
    </div>
  )
}
