'use client'

import { useEffect, useState } from 'react'
import type {
  BrowseQueryState,
  CompanionFilter,
  TravelGradeFilter,
} from '@/lib/products-browse-query'

const TRAVEL_GRADE_OPTIONS: { id: TravelGradeFilter; label: string }[] = [
  { id: 'value', label: '가성비' },
  { id: 'standard', label: '스탠다드' },
  { id: 'premium', label: '프리미엄' },
]

const COMPANION_OPTIONS: { id: CompanionFilter; label: string }[] = [
  { id: 'kids', label: '아이와 함께' },
  { id: 'parents', label: '부모님과 함께' },
  { id: 'couple', label: '커플/부부' },
  { id: 'friends', label: '친구와 함께' },
]
export type BrowseFacets = {
  brands: { brandKey: string; displayName: string; count: number }[]
  airlines: { code: string; label: string; count: number }[]
  hasDepartureTimeData: boolean
  hasWeekdayData: boolean
}

const HOUR_BUCKETS = [
  { id: '04-07', label: '04~07시' },
  { id: '07-11', label: '07~11시' },
  { id: '11-14', label: '11~14시' },
  { id: '14-16', label: '14~16시' },
  { id: '16-20', label: '16~20시' },
  { id: '20-24', label: '20~24시' },
] as const

const WEEKDAYS: { id: number; label: string }[] = [
  { id: 1, label: '월' },
  { id: 2, label: '화' },
  { id: 3, label: '수' },
  { id: 4, label: '목' },
  { id: 5, label: '금' },
  { id: 6, label: '토' },
  { id: 0, label: '일' },
]

const PRESETS: {
  id: string
  label: string
  budgetMin: number | null
  budgetPerPerson: number | null
}[] = [
  { id: 'u100', label: '100만원 이하', budgetMin: null, budgetPerPerson: 1_000_000 },
  { id: 'r100-150', label: '100~150만원', budgetMin: 1_000_000, budgetPerPerson: 1_500_000 },
  { id: 'r150-200', label: '150~200만원', budgetMin: 1_500_000, budgetPerPerson: 2_000_000 },
  { id: 'r200-300', label: '200~300만원', budgetMin: 2_000_000, budgetPerPerson: 3_000_000 },
  { id: 'o300', label: '300만원 이상', budgetMin: 3_000_000, budgetPerPerson: null },
]

function Section({
  title,
  defaultOpen = true,
  children,
  badge,
}: {
  title: string
  defaultOpen?: boolean
  badge?: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-900"
      >
        <span>
          {title}
          {badge != null && badge > 0 ? (
            <span className="ml-1.5 rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-800">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="text-slate-400">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  )
}

function ToggleRow({
  checked,
  label,
  onChange,
  disabled,
}: {
  checked: boolean
  label: string
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 text-sm ${disabled ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

type Props = {
  q: BrowseQueryState
  facets: BrowseFacets
  onPatch: (patch: Partial<BrowseQueryState>) => void
  airlineShowAll: boolean
  setAirlineShowAll: (v: boolean) => void
  travelContext?: 'overseas' | 'domestic'
}

export default function ProductFilterForm({
  q,
  facets,
  onPatch,
  airlineShowAll,
  setAirlineShowAll,
  travelContext = 'overseas',
}: Props) {
  const transportSectionTitle = travelContext === 'domestic' ? '교통수단' : '항공사'
  const transportEmptyText =
    travelContext === 'domestic'
      ? '교통수단 정보가 있는 등록 상품이 없습니다.'
      : '항공사 정보가 있는 등록 상품이 없습니다.'
  const transportToggleText = travelContext === 'domestic' ? '교통수단 더보기' : '항공사 더보기'
  const transportToggleFoldText = travelContext === 'domestic' ? '교통수단 접기' : '항공사 접기'

  const [budgetMinInput, setBudgetMinInput] = useState('')
  const [budgetMaxInput, setBudgetMaxInput] = useState('')
  const [budgetRangeError, setBudgetRangeError] = useState<string | null>(null)

  useEffect(() => {
    setBudgetMinInput(q.budgetMin != null ? q.budgetMin.toLocaleString('ko-KR') : '')
    setBudgetMaxInput(q.budgetPerPerson != null ? q.budgetPerPerson.toLocaleString('ko-KR') : '')
  }, [q.budgetMin, q.budgetPerPerson])

  const parseBudgetInput = (raw: string): number | null => {
    const digits = raw.replace(/[^\d]/g, '')
    if (!digits) return null
    const n = parseInt(digits, 10)
    if (Number.isNaN(n) || n < 0) return null
    return n
  }

  const formatBudgetInput = (raw: string): string => {
    const digits = raw.replace(/[^\d]/g, '')
    if (!digits) return ''
    return parseInt(digits, 10).toLocaleString('ko-KR')
  }

  const applyBudgetMin = (nextRaw: string) => {
    const formatted = formatBudgetInput(nextRaw)
    setBudgetMinInput(formatted)
    const min = parseBudgetInput(formatted)
    const max = parseBudgetInput(budgetMaxInput)
    if (min != null && max != null && min > max) {
      // min > max 는 적용 막지 않고 max를 맞춰 자동 보정
      setBudgetRangeError('최소 예산이 최대 예산보다 커서 최대값을 자동 조정했습니다.')
      setBudgetMaxInput(min.toLocaleString('ko-KR'))
      onPatch({ budgetMin: min, budgetPerPerson: min, page: 1, sort: 'budget_fit' })
      return
    }
    setBudgetRangeError(null)
    onPatch({
      budgetMin: min,
      page: 1,
      sort: min != null || max != null ? 'budget_fit' : 'popular',
    })
  }

  const applyBudgetMax = (nextRaw: string) => {
    const formatted = formatBudgetInput(nextRaw)
    setBudgetMaxInput(formatted)
    const max = parseBudgetInput(formatted)
    const min = parseBudgetInput(budgetMinInput)
    if (min != null && max != null && min > max) {
      setBudgetRangeError('최대 예산이 최소 예산보다 작아 최소값을 자동 조정했습니다.')
      setBudgetMinInput(max.toLocaleString('ko-KR'))
      onPatch({ budgetMin: max, budgetPerPerson: max, page: 1, sort: 'budget_fit' })
      return
    }
    setBudgetRangeError(null)
    onPatch({
      budgetPerPerson: max,
      page: 1,
      sort: min != null || max != null ? 'budget_fit' : 'popular',
    })
  }

  const toggle = <T,>(arr: T[], v: T, eq: (a: T, b: T) => boolean): T[] =>
    arr.some((x) => eq(x, v)) ? arr.filter((x) => !eq(x, v)) : [...arr, v]

  const brandCount = q.brands.length
  const gradeCount = q.travelGrades.length
  const companionCount = q.companions.length
  const airCount = q.airlines.length
  const hourCount = q.departHours.length
  const dayCount = q.departWeekdays.length
  let budgetCount = 0
  if (q.budgetMin != null) budgetCount++
  if (q.budgetPerPerson != null) budgetCount++

  const airSorted = [...facets.airlines].sort((a, b) => {
    if (a.code === 'other') return 1
    if (b.code === 'other') return -1
    return a.label.localeCompare(b.label, 'ko')
  })
  const airVisible = airlineShowAll ? airSorted : airSorted.slice(0, 6)

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">상세조건</p>

      <Section title="기본" badge={(q.confirmed ? 1 : 0) + (q.noOptionalTour ? 1 : 0) + (q.noShopping ? 1 : 0) + (q.freeSchedule ? 1 : 0)}>
        <ToggleRow
          checked={q.confirmed}
          label="출발확정"
          onChange={(v) => onPatch({ confirmed: v, page: 1 })}
        />
        <ToggleRow
          checked={q.noOptionalTour}
          label="현지옵션 없음"
          onChange={(v) => onPatch({ noOptionalTour: v, page: 1 })}
        />
        <ToggleRow
          checked={q.noShopping}
          label="쇼핑 없음"
          onChange={(v) => onPatch({ noShopping: v, page: 1 })}
        />
        <ToggleRow
          checked={q.freeSchedule}
          label="자유일정 포함"
          onChange={(v) => onPatch({ freeSchedule: v, page: 1 })}
        />
      </Section>

      <Section title="여행사" badge={brandCount}>
        <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
          {facets.brands.map((b) => (
            <ToggleRow
              key={b.brandKey}
              checked={q.brands.includes(b.brandKey)}
              label={`${b.displayName} (${b.count})`}
              onChange={() =>
                onPatch({
                  brands: toggle(q.brands, b.brandKey, (a, x) => a === x),
                  page: 1,
                })
              }
            />
          ))}
          {facets.brands.length === 0 && <p className="text-xs text-slate-500">표시할 공급사가 없습니다.</p>}
        </div>
      </Section>

      <Section title="여행 등급" badge={gradeCount}>
        {TRAVEL_GRADE_OPTIONS.map(({ id, label }) => (
          <ToggleRow
            key={id}
            checked={q.travelGrades.includes(id)}
            label={label}
            onChange={() =>
              onPatch({
                travelGrades: toggle(q.travelGrades, id, (a, x) => a === x),
                page: 1,
              })
            }
          />
        ))}
      </Section>

      <Section title="동행자" badge={companionCount}>
        {COMPANION_OPTIONS.map(({ id, label }) => (
          <ToggleRow
            key={id}
            checked={q.companions.includes(id)}
            label={label}
            onChange={() =>
              onPatch({
                companions: toggle(q.companions, id, (a, x) => a === x),
                page: 1,
              })
            }
          />
        ))}
      </Section>

      <Section title={transportSectionTitle} badge={airCount}>
        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {airVisible.map((fc) => (
            <ToggleRow
              key={fc.code}
              checked={q.airlines.includes(fc.code)}
              label={`${fc.label} (${fc.count})`}
              onChange={() =>
                onPatch({
                  airlines: toggle(q.airlines, fc.code, (a, x) => a === x),
                  page: 1,
                })
              }
            />
          ))}
          {facets.airlines.length === 0 && <p className="text-xs text-slate-500">{transportEmptyText}</p>}
        </div>
        {facets.airlines.length > 6 && (
          <button
            type="button"
            className="text-xs font-medium text-teal-800 underline"
            onClick={() => setAirlineShowAll(!airlineShowAll)}
          >
            {airlineShowAll ? transportToggleFoldText : transportToggleText}
          </button>
        )}
      </Section>

      <Section title="출발 항공 시간대" badge={hourCount} defaultOpen={false}>
        {!facets.hasDepartureTimeData ? (
          <p className="text-xs text-amber-800">출발 시각(outbound) 데이터가 있는 상품이 없어 이 필터는 비활성입니다.</p>
        ) : (
          HOUR_BUCKETS.map((h) => (
            <ToggleRow
              key={h.id}
              checked={q.departHours.includes(h.id)}
              label={h.label}
              disabled={!facets.hasDepartureTimeData}
              onChange={() =>
                onPatch({
                  departHours: toggle(q.departHours, h.id, (a, x) => a === x),
                  page: 1,
                })
              }
            />
          ))
        )}
      </Section>

      <Section title="출발요일" badge={dayCount} defaultOpen={false}>
        {!facets.hasWeekdayData ? (
          <p className="text-xs text-amber-800">출발일 데이터가 없어 요일 필터는 비활성입니다.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() =>
                  onPatch({
                    departWeekdays: toggle(q.departWeekdays, w.id, (a, x) => a === x),
                    page: 1,
                  })
                }
                className={
                  q.departWeekdays.includes(w.id)
                    ? 'rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white'
                    : 'rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50'
                }
              >
                {w.label}
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title="1인당 예산" badge={budgetCount > 0 ? budgetCount : undefined}>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                onPatch({
                  budgetMin: p.budgetMin,
                  budgetPerPerson: p.budgetPerPerson,
                  page: 1,
                  sort: p.budgetPerPerson != null || p.budgetMin != null ? 'budget_fit' : 'popular',
                })
              }
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 hover:border-teal-400"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9,]*"
            className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm placeholder:text-xs placeholder:text-slate-400"
            placeholder="최소 1인당 예산"
            value={budgetMinInput}
            onChange={(e) => applyBudgetMin(e.target.value)}
            aria-label="최소 1인당 예산"
          />
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9,]*"
            className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm placeholder:text-xs placeholder:text-slate-400"
            placeholder="최대 1인당 예산"
            value={budgetMaxInput}
            onChange={(e) => applyBudgetMax(e.target.value)}
            aria-label="최대 1인당 예산"
          />
        </div>
        {budgetRangeError && <p className="mt-2 text-[11px] text-amber-700">{budgetRangeError}</p>}
      </Section>
    </div>
  )
}
