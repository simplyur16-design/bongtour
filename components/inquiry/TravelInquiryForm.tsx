'use client'

import { useCallback, useId, useState } from 'react'
import InquiryFormShell from '@/components/inquiry/InquiryFormShell'
import { inquiryShellCopy } from '@/lib/inquiry-form-i18n'
import type { InquiryPageQuery } from '@/lib/inquiry-page'

type Props = { initialQuery: InquiryPageQuery }

function parseCount(v: string): number | undefined {
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export default function TravelInquiryForm({ initialQuery }: Props) {
  const id = useId()
  const copy = inquiryShellCopy(initialQuery.uiLang ?? 'ko')
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
            {copy.monthLabel} <span className="text-slate-400">{copy.optional}</span>
          </label>
          <p className="mt-0.5 text-xs text-slate-500">{copy.monthHint}</p>
          {copy.monthHintEn ? <p className="mt-0.5 text-xs text-slate-400">{copy.monthHintEn}</p> : null}
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
              {copy.adult}
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
              {copy.child}
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
              {copy.infant}
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
        <p className="text-xs text-slate-500">{copy.paxHint}</p>
        {copy.paxHintEn ? <p className="text-xs text-slate-400">{copy.paxHintEn}</p> : null}
        <div>
          <label htmlFor={`${id}-region`} className="block text-sm font-medium text-slate-700">
            {copy.region} <span className="text-slate-400">{copy.optional}</span>
          </label>
          <input
            id={`${id}-region`}
            name="preferredRegion"
            type="text"
            value={preferredRegion}
            onChange={(e) => setPreferredRegion(e.target.value)}
            placeholder={copy.regionPlaceholder}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>
    </InquiryFormShell>
  )
}
