'use client'

/**
 * 해외 허브 패키지 / 자유여행 칩.
 * REGRESSION-FREEZE[overseas-hub-package-fit-split]: 허브 type 칩 — manifest
 */
import {
  parseOverseasHubTravelType,
  type OverseasHubTravelType,
} from '@/lib/overseas-hub-client-catalog-filter'
import {
  getOverseasHubSearchParamsString,
  replaceOverseasHubUrl,
  subscribeOverseasHubUrl,
} from '@/lib/overseas-hub-client-nav'
import { useSyncExternalStore } from 'react'

const CHIPS: { id: OverseasHubTravelType; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'package', label: '패키지' },
  { id: 'free', label: '자유여행' },
]

function applyTravelTypeToParams(params: URLSearchParams, next: OverseasHubTravelType): void {
  params.delete('travelType')
  if (next === 'all') params.delete('type')
  else if (next === 'package') params.set('type', 'travel')
  else params.set('type', 'air-hotel')
}

export default function OverseasHubTravelTypeChips() {
  const searchParamsString = useSyncExternalStore(
    subscribeOverseasHubUrl,
    getOverseasHubSearchParamsString,
    () => '',
  )
  const active = parseOverseasHubTravelType(new URLSearchParams(searchParamsString))

  return (
    <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="여행 유형">
      {CHIPS.map((chip) => {
        const on = active === chip.id
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => {
              const p = new URLSearchParams(getOverseasHubSearchParamsString())
              applyTravelTypeToParams(p, chip.id)
              replaceOverseasHubUrl(p)
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              on
                ? 'border-bt-accent bg-bt-accent-subtle text-bt-ink shadow-sm'
                : 'border-bt-border bg-bt-surface text-bt-muted hover:border-bt-accent/35'
            }`}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
