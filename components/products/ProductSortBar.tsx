'use client'

import type { BrowseSort } from '@/lib/products-browse-filter'

const SORTS: { key: BrowseSort; label: string }[] = [
  { key: 'budget_fit', label: '예산에 가까운 순' },
  { key: 'popular', label: '인기순' },
  { key: 'price_asc', label: '낮은 가격순' },
  { key: 'price_desc', label: '높은 가격순' },
  { key: 'departure_asc', label: '출발일 빠른 순' },
]

type Props = {
  sort: BrowseSort
  onChange: (sort: BrowseSort) => void
  budgetActive: boolean
}

export default function ProductSortBar({ sort, onChange, budgetActive }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
      <span className="text-xs font-medium text-slate-500">정렬</span>
      {SORTS.map(({ key, label }) => {
        if (key === 'budget_fit' && !budgetActive) return null
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={
              sort === key
                ? 'rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white'
                : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50'
            }
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
