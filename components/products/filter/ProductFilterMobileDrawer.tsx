'use client'

import type { BrowseQueryState } from '@/lib/products-browse-query'
import ProductFilterForm, { type BrowseFacets } from '@/components/products/filter/ProductFilterForm'

type Props = {
  open: boolean
  onClose: () => void
  facets: BrowseFacets
  draft: BrowseQueryState
  setDraft: (q: BrowseQueryState) => void
  airlineShowAll: boolean
  setAirlineShowAll: (v: boolean) => void
  onApply: () => void
  onReset: () => void
}

export default function ProductFilterMobileDrawer({
  open,
  onClose,
  facets,
  draft,
  setDraft,
  airlineShowAll,
  setAirlineShowAll,
  onApply,
  onReset,
}: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">필터</h2>
          <button type="button" className="text-sm text-slate-600" onClick={onClose}>
            닫기
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <ProductFilterForm
            q={draft}
            facets={facets}
            onPatch={(patch) => setDraft({ ...draft, ...patch, page: patch.page ?? draft.page })}
            airlineShowAll={airlineShowAll}
            setAirlineShowAll={setAirlineShowAll}
          />
        </div>
        <div className="flex gap-2 border-t border-slate-200 p-4">
          <button
            type="button"
            className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-800"
            onClick={onReset}
          >
            초기화
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            onClick={onApply}
          >
            적용
          </button>
        </div>
      </div>
    </div>
  )
}
