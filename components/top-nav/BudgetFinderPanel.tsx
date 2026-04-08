'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

const QUICK_RANGES: { label: string; max: number }[] = [
  { label: '100만원 이하', max: 1_000_000 },
  { label: '100~150만원', max: 1_500_000 },
  { label: '150~200만원', max: 2_000_000 },
  { label: '200~300만원', max: 3_000_000 },
  { label: '300만원 이상', max: 999_999_999 },
]

type Props = {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
}

export default function BudgetFinderPanel({ open, onClose, anchorRef }: Props) {
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const [budgetInput, setBudgetInput] = useState('')
  const [tripDays, setTripDays] = useState('')
  const [month, setMonth] = useState('')
  const [regionPref, setRegionPref] = useState('')

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t)) return
      if (anchorRef.current?.contains(t)) return
      onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose, anchorRef])

  const go = useCallback(() => {
    const raw = budgetInput.replace(/[^\d]/g, '')
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n) || n <= 0) return
    const params = new URLSearchParams()
    params.set('budgetPerPerson', String(n))
    params.set('sort', 'budget_fit')
    if (tripDays.trim()) params.set('tripDays', tripDays.trim())
    if (/^\d{4}-\d{2}$/.test(month.trim())) params.set('departMonth', month.trim())
    if (regionPref.trim()) params.set('regionPref', regionPref.trim())
    router.push(`/products?${params.toString()}`)
    onClose()
  }, [budgetInput, tripDays, month, regionPref, router, onClose])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-labelledby={titleId}
      className="absolute right-0 top-full z-[60] mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
    >
      <div className="border-b border-slate-100 pb-2">
        <h2 id={titleId} className="text-sm font-bold text-slate-900">
          인당 예산으로 상품 찾기
        </h2>
        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          등록된 상품의 실제 금액을 확인하여, 입력하신 인당 예산 이하인 상품만 보여 드립니다.
        </p>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <span className="text-[12px] font-semibold text-slate-800">인당 예산 (원)</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {QUICK_RANGES.map((q) => (
              <button
                key={q.label}
                type="button"
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50"
                onClick={() => setBudgetInput(String(q.max))}
              >
                {q.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            inputMode="numeric"
            placeholder="예: 1500000"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block text-[12px] text-slate-700">
            <span className="font-medium">여행 기간 (일)</span>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={tripDays}
              onChange={(e) => setTripDays(e.target.value)}
              placeholder="선택"
            />
          </label>
          <label className="block text-[12px] text-slate-700">
            <span className="font-medium">출발 희망월</span>
            <input
              type="month"
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
        </div>
        <label className="block text-[12px] text-slate-700">
          <span className="font-medium">지역 선호 (선택)</span>
          <input
            type="text"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            value={regionPref}
            onChange={(e) => setRegionPref(e.target.value)}
            placeholder="예: 동남아, 유럽"
          />
        </label>

        <button
          type="button"
          className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          onClick={go}
        >
          관련 상품 보기
        </button>
      </div>
    </div>
  )
}
