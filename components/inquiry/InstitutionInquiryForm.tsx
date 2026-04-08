'use client'

import { useCallback, useId, useState } from 'react'
import InquiryFormShell from '@/components/inquiry/InquiryFormShell'
import type { InquiryPageQuery } from '@/lib/inquiry-page'

type Props = { initialQuery: InquiryPageQuery }

export default function InstitutionInquiryForm({ initialQuery }: Props) {
  const id = useId()
  const [organizationName, setOrganizationName] = useState('')
  const [preferredCountryCity, setPreferredCountryCity] = useState('')
  const [visitField, setVisitField] = useState('')
  const [preferredTiming, setPreferredTiming] = useState('')
  const [estimatedHeadcount, setEstimatedHeadcount] = useState('')
  const [interpreterNeeded, setInterpreterNeeded] = useState(false)
  const [targetYearMonth, setTargetYearMonth] = useState(initialQuery.targetYearMonth ?? '')

  const buildPayloadJson = useCallback(() => {
    const head =
      estimatedHeadcount.trim() === ''
        ? undefined
        : parseInt(estimatedHeadcount, 10)
    return {
      ...(organizationName.trim() ? { organizationName: organizationName.trim() } : {}),
      ...(preferredCountryCity.trim() ? { preferredCountryCity: preferredCountryCity.trim() } : {}),
      ...(visitField.trim() ? { visitField: visitField.trim() } : {}),
      ...(preferredTiming.trim() ? { preferredTiming: preferredTiming.trim() } : {}),
      ...(head !== undefined && Number.isFinite(head) ? { estimatedHeadcount: head } : {}),
      interpreterNeeded,
      ...(targetYearMonth.trim() ? { targetYearMonth: targetYearMonth.trim() } : {}),
    }
  }, [
    estimatedHeadcount,
    interpreterNeeded,
    organizationName,
    preferredCountryCity,
    preferredTiming,
    targetYearMonth,
    visitField,
  ])

  return (
    <InquiryFormShell kind="institution" initialQuery={initialQuery} buildPayloadJson={buildPayloadJson}>
      <div className="space-y-4">
        <div>
          <label htmlFor={`${id}-org`} className="block text-sm font-medium text-slate-700">
            기관명·단체명 <span className="text-slate-400">(선택)</span>
          </label>
          <input
            id={`${id}-org`}
            name="organizationName"
            type="text"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
        <div>
          <label htmlFor={`${id}-city`} className="block text-sm font-medium text-slate-700">
            희망 국가·도시 <span className="text-slate-400">(선택)</span>
          </label>
          <input
            id={`${id}-city`}
            name="preferredCountryCity"
            type="text"
            value={preferredCountryCity}
            onChange={(e) => setPreferredCountryCity(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
        <div>
          <label htmlFor={`${id}-field`} className="block text-sm font-medium text-slate-700">
            희망 방문 분야 <span className="text-slate-400">(선택)</span>
          </label>
          <input
            id={`${id}-field`}
            name="visitField"
            type="text"
            value={visitField}
            onChange={(e) => setVisitField(e.target.value)}
            placeholder="예: 대학 교류, 시청·공공기관, 기업 본사"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
        <div>
          <label htmlFor={`${id}-timing`} className="block text-sm font-medium text-slate-700">
            희망 일정 시기 <span className="text-slate-400">(선택)</span>
          </label>
          <input
            id={`${id}-timing`}
            name="preferredTiming"
            type="text"
            value={preferredTiming}
            onChange={(e) => setPreferredTiming(e.target.value)}
            placeholder="예: 2026년 봄학기, 4월 중 5일"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
        <div>
          <label htmlFor={`${id}-ym`} className="block text-sm font-medium text-slate-700">
            기준 희망 월 <span className="text-slate-400">(선택)</span>
          </label>
          <p className="mt-0.5 text-xs text-slate-500">리드타임 안내용입니다. 위 일정 시기와 다를 수 있습니다.</p>
          <input
            id={`${id}-ym`}
            name="targetYearMonth"
            type="month"
            value={targetYearMonth}
            onChange={(e) => setTargetYearMonth(e.target.value)}
            className="mt-1.5 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
        <div>
          <label htmlFor={`${id}-pax`} className="block text-sm font-medium text-slate-700">
            예상 인원 <span className="text-slate-400">(선택)</span>
          </label>
          <input
            id={`${id}-pax`}
            name="estimatedHeadcount"
            type="number"
            min={0}
            inputMode="numeric"
            value={estimatedHeadcount}
            onChange={(e) => setEstimatedHeadcount(e.target.value)}
            className="mt-1.5 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
        <div className="flex gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <input
            id={`${id}-interp`}
            name="interpreterNeeded"
            type="checkbox"
            checked={interpreterNeeded}
            onChange={(e) => setInterpreterNeeded(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
          />
          <label htmlFor={`${id}-interp`} className="text-sm text-slate-700">
            통역·현지 코디 지원이 필요합니다
          </label>
        </div>
      </div>
    </InquiryFormShell>
  )
}
