'use client'

import type { AirHotelRegionChip } from '@/lib/air-hotel-region-filter'

type Props = {
  chips: AirHotelRegionChip[]
  selectedBucketId: string | null
  onSelectAll: () => void
  onSelectBucket: (bucketId: string) => void
}

const chipBase =
  'flex flex-col items-center justify-center rounded-full border text-center font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600'

const chipSelected = 'border-teal-600 bg-teal-600 text-white'
const chipIdle = 'border-slate-200 bg-white text-slate-700 hover:border-teal-300'

/** 모바일: 4열·컴팩트 / PC: flex wrap */
const chipMobile = 'min-h-0 px-1.5 py-1 text-[10px] leading-tight'
const chipDesktop = 'md:min-h-0 md:px-3.5 md:py-2 md:text-sm md:leading-snug'

/**
 * 자유여행 권역 필터 — 메가메뉴 권역 단위.
 * - 모바일: 4열 그리드·칩 크기 절반·문구 중앙 정렬
 * - PC: flex wrap
 */
export default function AirHotelRegionChipRow({
  chips,
  selectedBucketId,
  onSelectAll,
  onSelectBucket,
}: Props) {
  if (chips.length === 0) return null

  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-medium text-slate-500 md:text-sm">권역</p>
      <div
        className="grid grid-cols-4 gap-1.5 md:flex md:flex-wrap md:gap-2.5"
        role="tablist"
        aria-label="권역별 필터"
      >
        <button
          type="button"
          role="tab"
          aria-selected={!selectedBucketId}
          onClick={onSelectAll}
          className={`${chipBase} ${chipMobile} ${chipDesktop} ${
            !selectedBucketId ? chipSelected : chipIdle
          }`}
        >
          전체
        </button>
        {chips.map((c) => {
          const sel = selectedBucketId === c.id
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={sel}
              onClick={() => onSelectBucket(c.id)}
              className={`${chipBase} ${chipMobile} ${chipDesktop} md:shrink-0 ${
                sel ? chipSelected : chipIdle
              }`}
            >
              <span className="line-clamp-2 w-full text-center md:line-clamp-none">{c.label}</span>
              <span className="mt-0.5 tabular-nums opacity-90">({c.count})</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
