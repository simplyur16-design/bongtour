'use client'

import type { MegaMenuRegion } from '@/lib/travel-landing-mega-menu-data'

type Props = {
  regions: MegaMenuRegion[]
  activeRegionId: string | null
  onHoverRegion: (id: string) => void
}

export default function RegionHoverTabs({ regions, activeRegionId, onHoverRegion }: Props) {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div
        className="mx-auto flex w-full max-w-6xl flex-nowrap items-stretch justify-center gap-0 overflow-x-auto px-2 py-0 text-center [-ms-overflow-style:none] [scrollbar-width:none] sm:px-3 [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="권역"
      >
        {regions.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={activeRegionId === r.id}
            className={
              activeRegionId === r.id
                ? 'shrink-0 whitespace-nowrap border-b-2 border-orange-500 bg-white px-3 py-3 text-center text-[12px] font-bold text-orange-500 sm:px-3.5 sm:text-[13px]'
                : 'shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-center text-[12px] font-medium text-slate-400 transition hover:border-slate-300 hover:text-slate-600 sm:px-3.5 sm:text-[13px]'
            }
            onMouseEnter={() => onHoverRegion(r.id)}
            onFocus={() => onHoverRegion(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  )
}
