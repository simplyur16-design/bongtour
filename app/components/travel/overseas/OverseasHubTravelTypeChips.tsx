'use client'

/**
 * 해외 허브 — 패키지 기본. 자유여행은 /travel/air-hotel 로 이동(목록 혼입 금지).
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
import { useRouter } from 'next/navigation'
import { useSyncExternalStore } from 'react'

const CHIPS: { id: Exclude<OverseasHubTravelType, 'all'>; label: string }[] = [
  { id: 'package', label: '패키지' },
  { id: 'free', label: '자유여행' },
]

const GEO_KEYS = ['region', 'country', 'city', 'destination', 'menuGroup', 'sportsTheme'] as const

function applyPackageTypeToParams(params: URLSearchParams): void {
  params.delete('travelType')
  params.set('type', 'travel')
}

function buildAirHotelHrefFromOverseasParams(params: URLSearchParams): string {
  const next = new URLSearchParams()
  next.set('scope', 'overseas')
  next.set('type', 'air-hotel')
  for (const k of GEO_KEYS) {
    const v = (params.get(k) ?? '').trim()
    if (v) next.set(k, v)
  }
  return `/travel/air-hotel?${next.toString()}`
}

export default function OverseasHubTravelTypeChips() {
  const router = useRouter()
  const searchParamsString = useSyncExternalStore(
    subscribeOverseasHubUrl,
    getOverseasHubSearchParamsString,
    () => '',
  )
  const active = parseOverseasHubTravelType(new URLSearchParams(searchParamsString))

  return (
    <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="여행 유형">
      {CHIPS.map((chip) => {
        const on = chip.id === 'package' ? active !== 'free' : active === 'free'
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => {
              const p = new URLSearchParams(getOverseasHubSearchParamsString())
              if (chip.id === 'free') {
                router.push(buildAirHotelHrefFromOverseasParams(p))
                return
              }
              applyPackageTypeToParams(p)
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
