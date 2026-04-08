'use client'

import { useCallback, useId, useState } from 'react'
import InquiryFormShell from '@/components/inquiry/InquiryFormShell'
import type { InquiryPageQuery } from '@/lib/inquiry-page'

type Props = { initialQuery: InquiryPageQuery }

function parseCount(v: string): number | undefined {
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export default function TravelInquiryForm({ initialQuery }: Props) {
  const id = useId()
  const [targetYearMonth, setTargetYearMonth] = useState(initialQuery.targetYearMonth ?? '')
  const [adultCount, setAdultCount] = useState('2')
  const [childCount, setChildCount] = useState('0')
  const [infantCount, setInfantCount] = useState('0')
  const [preferredRegion, setPreferredRegion] = useState('')

  const buildPayloadJson = useCallback(() => {
    const adult = parseCount(adultCount)
    const child = parseCount(childCount)
    const infant = parseCount(infantCount)
    return {
      ...(targetYearMonth.trim() ? { targetYearMonth: targetYearMonth.trim() } : {}),
      ...(adult !== undefined ? { adultCount: adult } : {}),
      ...(child !== undefined ? { childCount: child } : {}),
      ...(infant !== undefined ? { infantCount: infant } : {}),
      ...(preferredRegion.trim() ? { preferredRegion: preferredRegion.trim() } : {}),
    }
  }, [adultCount, childCount, infantCount, preferredRegion, targetYearMonth])

  return (
    <InquiryFormShell kind="travel" initialQuery={initialQuery} buildPayloadJson={buildPayloadJson}>
      <div className="space-y-4">
        <div>
          <label htmlFor={`${id}-ym`} className="block text-sm font-medium text-slate-700">
            희망 출발 월 <span className="text-slate-400">(선택)</span>
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            선택 시 일정 촉박도 안내에 참고됩니다. 미선택도 가능합니다.
          </p>
          <input
            id={`${id}-ym`}
            name="targetYearMonth"
            type="month"
            value={targetYearMonth}
            onChange={(e) => setTargetYearMonth(e.target.value)}
            className="mt-1.5 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`${id}-adult`} className="block text-sm font-medium text-slate-700">
              성인(만 12세 이상)
            </label>
            <input
              id={`${id}-adult`}
              name="adultCount"
              type="number"
              min={0}
              inputMode="numeric"
              value={adultCount}
              onChange={(e) => setAdultCount(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label htmlFor={`${id}-child`} className="block text-sm font-medium text-slate-700">
              아동(만 2세 이상~만 12세 미만)
            </label>
            <input
              id={`${id}-child`}
              name="childCount"
              type="number"
              min={0}
              inputMode="numeric"
              value={childCount}
              onChange={(e) => setChildCount(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label htmlFor={`${id}-infant`} className="block text-sm font-medium text-slate-700">
              유아(만 2세 미만)
            </label>
            <input
              id={`${id}-infant`}
              name="infantCount"
              type="number"
              min={0}
              inputMode="numeric"
              value={infantCount}
              onChange={(e) => setInfantCount(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          인원 기준은 일반적인 여행 기준이며, 실제 적용은 상품/항공 규정에 따라 달라질 수 있습니다.
        </p>
        <div>
          <label htmlFor={`${id}-region`} className="block text-sm font-medium text-slate-700">
            희망 지역·국가 <span className="text-slate-400">(선택)</span>
          </label>
          <input
            id={`${id}-region`}
            name="preferredRegion"
            type="text"
            value={preferredRegion}
            onChange={(e) => setPreferredRegion(e.target.value)}
            placeholder="예: 다낭, 오사카, 스위스 알프스"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>
    </InquiryFormShell>
  )
}
