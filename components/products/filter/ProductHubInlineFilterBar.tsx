'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import ProductSortBar from '@/components/products/ProductSortBar'
import type { BrowseFacets } from '@/components/products/filter/ProductFilterForm'
import type { BrowseSort } from '@/lib/products-browse-filter'
import type { BrowseQueryState } from '@/lib/products-browse-query'
import { catalogEntryByCode } from '@/lib/airline-catalog'

type Props = {
  q: BrowseQueryState
  facets: BrowseFacets
  sort: BrowseSort
  budgetActive: boolean
  listedCount?: number | null
  onPatch: (patch: Partial<BrowseQueryState>) => void
  onSortChange: (sort: BrowseSort) => void
}

function FilterToggleChip({
  label,
  active,
  onChange,
}: {
  label: string
  active: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onChange(!active)}
      className={
        active
          ? 'rounded-full bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm'
          : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50'
      }
    >
      {label}
    </button>
  )
}

function toggleAirline(airlines: string[], code: string): string[] {
  return airlines.includes(code) ? airlines.filter((a) => a !== code) : [...airlines, code]
}

export default function ProductHubInlineFilterBar({
  q,
  facets,
  sort,
  budgetActive,
  listedCount,
  onPatch,
  onSortChange,
}: Props) {
  const [airlineOpen, setAirlineOpen] = useState(false)
  const [airlineShowAll, setAirlineShowAll] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!airlineOpen) return
    const onDoc = (e: MouseEvent) => {
      if (!popoverRef.current?.contains(e.target as Node)) setAirlineOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [airlineOpen])

  const airSorted = useMemo(
    () =>
      [...facets.airlines].sort((a, b) => {
        if (a.code === 'other') return 1
        if (b.code === 'other') return -1
        return a.label.localeCompare(b.label, 'ko')
      }),
    [facets.airlines],
  )
  const airVisible = airlineShowAll ? airSorted : airSorted.slice(0, 8)

  const airlineButtonLabel = useMemo(() => {
    if (q.airlines.length === 0) return '항공사'
    if (q.airlines.length === 1) {
      const code = q.airlines[0]!
      if (code === 'other') return '항공사 · 기타'
      return `항공사 · ${catalogEntryByCode(code)?.label ?? code}`
    }
    return `항공사 · ${q.airlines.length}`
  }, [q.airlines])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterToggleChip
            label="현지옵션 없음"
            active={q.noOptionalTour}
            onChange={(v) => onPatch({ noOptionalTour: v, page: 1 })}
          />
          <FilterToggleChip
            label="쇼핑 없음"
            active={q.noShopping}
            onChange={(v) => onPatch({ noShopping: v, page: 1 })}
          />
          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              onClick={() => setAirlineOpen((v) => !v)}
              className={
                q.airlines.length > 0
                  ? 'inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white'
                  : 'inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50'
              }
              aria-expanded={airlineOpen}
            >
              {airlineButtonLabel}
              <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
            </button>
            {airlineOpen ? (
              <div className="absolute left-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                <p className="text-xs font-semibold text-slate-700">항공사 (복수 선택)</p>
                <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1">
                  {airVisible.map((fc) => (
                    <label
                      key={fc.code}
                      className="flex cursor-pointer items-center gap-2 text-sm text-slate-800"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                        checked={q.airlines.includes(fc.code)}
                        onChange={() =>
                          onPatch({
                            airlines: toggleAirline(q.airlines, fc.code),
                            page: 1,
                          })
                        }
                      />
                      <span>
                        {fc.label} ({fc.count})
                      </span>
                    </label>
                  ))}
                  {facets.airlines.length === 0 ? (
                    <p className="text-xs text-slate-500">항공사 정보가 있는 상품이 없습니다.</p>
                  ) : null}
                </div>
                {facets.airlines.length > 8 ? (
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-teal-800 underline"
                    onClick={() => setAirlineShowAll((v) => !v)}
                  >
                    {airlineShowAll ? '항공사 접기' : '항공사 더보기'}
                  </button>
                ) : null}
                {q.airlines.length > 0 ? (
                  <button
                    type="button"
                    className="mt-3 w-full rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    onClick={() => onPatch({ airlines: [], page: 1 })}
                  >
                    항공사 선택 해제
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {listedCount != null ? (
          <span className="text-xs font-medium text-slate-500">{listedCount.toLocaleString('ko-KR')}건</span>
        ) : null}
      </div>
      <ProductSortBar sort={sort} budgetActive={budgetActive} onChange={onSortChange} />
    </div>
  )
}
