'use client'

import { useCallback, useId, useState } from 'react'
import InquiryFormShell from '@/components/inquiry/InquiryFormShell'
import type { FieldErrors } from '@/lib/customer-inquiry-intake'
import type { InquiryPageQuery } from '@/lib/inquiry-page'

const EMPTY_QUERY: InquiryPageQuery = {
  productId: null,
  monthlyCurationItemId: null,
  snapshotProductTitle: null,
  snapshotCardLabel: null,
  targetYearMonth: null,
  trainingServiceScope: null,
}

export default function PrivateQuoteFormEntry() {
  const id = useId()
  const [travelRegion, setTravelRegion] = useState('')
  const [destinationSummary, setDestinationSummary] = useState('')
  const [headcount, setHeadcount] = useState('')
  const [departureMonth, setDepartureMonth] = useState('')
  const [tripDuration, setTripDuration] = useState('')
  const [preferredDeparture, setPreferredDeparture] = useState('')
  const [budgetNote, setBudgetNote] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [travelType, setTravelType] = useState('')
  const [departureArea, setDepartureArea] = useState('')
  const [includeFlight, setIncludeFlight] = useState('')
  const [accommodationPreference, setAccommodationPreference] = useState('')
  const [extraRequest, setExtraRequest] = useState('')

  const validateBeforeSubmit = useCallback((): { fieldErrors?: FieldErrors; formError?: string } => {
    const fieldErrors: FieldErrors = {}
    if (!destinationSummary.trim()) fieldErrors.destinationSummary = '희망 여행지 또는 국가/도시를 입력해 주세요.'
    const headcountNum = parseInt(headcount.replace(/[^\d]/g, ''), 10)
    if (!headcount.trim()) fieldErrors.headcount = '인원을 입력해 주세요.'
    else if (!Number.isFinite(headcountNum) || headcountNum < 1) {
      fieldErrors.headcount = '인원은 1명 이상의 숫자로 입력해 주세요.'
    }
    if (!preferredDeparture && !departureMonth) {
      fieldErrors.departureDateOrMonth = '출발 희망일 또는 출발 희망월 중 하나를 입력해 주세요.'
    }
    if (Object.keys(fieldErrors).length > 0) {
      return {
        fieldErrors,
        formError: '필수 입력값을 확인해 주세요.',
      }
    }
    return {}
  }, [departureMonth, destinationSummary, headcount, preferredDeparture])

  const buildPayloadJson = useCallback(() => {
    const n = parseInt(headcount.replace(/[^\d]/g, ''), 10)
    return {
      quoteKind: 'private_custom' as const,
      consultType: 'PRIVATE_QUOTE',
      serviceDomain: 'overseas_travel',
      ...(travelRegion.trim() ? { travelRegion: travelRegion.trim() } : {}),
      ...(destinationSummary.trim() ? { destinationSummary: destinationSummary.trim() } : {}),
      ...(Number.isFinite(n) && n > 0 ? { headcount: n } : {}),
      ...(tripDuration.trim() ? { tripDuration: tripDuration.trim() } : {}),
      ...(preferredDeparture.trim() ? { preferredDepartureDate: preferredDeparture.trim() } : {}),
      ...(departureMonth.trim() ? { preferredDepartureMonth: departureMonth.trim() } : {}),
      ...(budgetNote.trim() ? { budgetNote: budgetNote.trim() } : {}),
      ...(organizationName.trim() ? { organizationName: organizationName.trim() } : {}),
      ...(travelType.trim() ? { travelType: travelType.trim() } : {}),
      ...(departureArea.trim() ? { departureArea: departureArea.trim() } : {}),
      ...(includeFlight.trim() ? { includeFlight: includeFlight.trim() } : {}),
      ...(accommodationPreference.trim() ? { accommodationPreference: accommodationPreference.trim() } : {}),
      ...(extraRequest.trim() ? { extraRequest: extraRequest.trim() } : {}),
    }
  }, [
    accommodationPreference,
    budgetNote,
    departureArea,
    departureMonth,
    destinationSummary,
    extraRequest,
    headcount,
    includeFlight,
    organizationName,
    preferredDeparture,
    travelRegion,
    travelType,
    tripDuration,
  ])

  return (
    <InquiryFormShell
      kind="travel"
      initialQuery={EMPTY_QUERY}
      overlayMeta={{
        title: '단독견적 문의하기',
        description:
          '원하시는 일정과 조건에 맞춰 별도로 견적을 안내해드립니다. 등록 상품 외 맞춤 일정이나 우리끼리 여행도 문의하실 수 있습니다.',
      }}
      buildPayloadJson={buildPayloadJson}
      beforeSubmit={validateBeforeSubmit}
      messageRequired
      messageLabel="문의 내용"
      submitButtonLabel="단독견적 문의 접수하기"
    >
      <div className="space-y-4">
        <div>
          <label htmlFor={`${id}-region`} className="block text-sm font-medium text-slate-700">
            여행 권역 <span className="text-slate-400">(선택)</span>
          </label>
          <input
            id={`${id}-region`}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            value={travelRegion}
            onChange={(e) => setTravelRegion(e.target.value)}
            placeholder="예: 동남아, 유럽"
          />
        </div>
        <div>
          <label htmlFor={`${id}-place`} className="block text-sm font-medium text-slate-700">
            희망 여행지 또는 국가/도시 <span className="text-rose-600">*</span>
          </label>
          <input
            id={`${id}-place`}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            value={destinationSummary}
            onChange={(e) => setDestinationSummary(e.target.value)}
            placeholder="예: 다낭, 오사카"
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-pax`} className="block text-sm font-medium text-slate-700">
              인원 <span className="text-rose-600">*</span>
            </label>
            <input
              id={`${id}-pax`}
              inputMode="numeric"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              value={headcount}
              onChange={(e) => setHeadcount(e.target.value)}
              placeholder="예: 4"
              required
            />
          </div>
          <div>
            <label htmlFor={`${id}-org`} className="block text-sm font-medium text-slate-700">
              단체명/소속명 <span className="text-slate-400">(선택)</span>
            </label>
            <input
              id={`${id}-org`}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="예: OO중학교, OO기업"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-dep`} className="block text-sm font-medium text-slate-700">
              출발 희망일 <span className="text-slate-400">(선택)</span>
            </label>
            <input
              id={`${id}-dep`}
              type="date"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              value={preferredDeparture}
              onChange={(e) => setPreferredDeparture(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`${id}-dep-month`} className="block text-sm font-medium text-slate-700">
              출발 희망월 <span className="text-slate-400">(선택)</span>
            </label>
            <input
              id={`${id}-dep-month`}
              type="month"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              value={departureMonth}
              onChange={(e) => setDepartureMonth(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-travel-type`} className="block text-sm font-medium text-slate-700">
              여행 유형 <span className="text-slate-400">(선택)</span>
            </label>
            <select
              id={`${id}-travel-type`}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              value={travelType}
              onChange={(e) => setTravelType(e.target.value)}
            >
              <option value="">선택 안 함</option>
              <option value="family">가족</option>
              <option value="friends">친구</option>
              <option value="couple">커플</option>
              <option value="group">단체</option>
              <option value="other">기타</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-dur`} className="block text-sm font-medium text-slate-700">
              희망 여행 기간 <span className="text-slate-400">(선택)</span>
            </label>
            <input
              id={`${id}-dur`}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              value={tripDuration}
              onChange={(e) => setTripDuration(e.target.value)}
              placeholder="예: 5박6일"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-budget-note`} className="block text-sm font-medium text-slate-700">
              희망 예산 범위 <span className="text-slate-400">(선택)</span>
            </label>
            <input
              id={`${id}-budget-note`}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              value={budgetNote}
              onChange={(e) => setBudgetNote(e.target.value)}
              placeholder="상담 참고용 예산 범위를 입력해 주세요"
            />
          </div>
          <div>
            <label htmlFor={`${id}-departure-area`} className="block text-sm font-medium text-slate-700">
              출발 지역 <span className="text-slate-400">(선택)</span>
            </label>
            <input
              id={`${id}-departure-area`}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              value={departureArea}
              onChange={(e) => setDepartureArea(e.target.value)}
              placeholder="예: 인천, 부산"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-flight`} className="block text-sm font-medium text-slate-700">
              항공 포함 여부 <span className="text-slate-400">(선택)</span>
            </label>
            <select
              id={`${id}-flight`}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              value={includeFlight}
              onChange={(e) => setIncludeFlight(e.target.value)}
            >
              <option value="">선택 안 함</option>
              <option value="include">포함 희망</option>
              <option value="exclude">불포함 희망</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-hotel`} className="block text-sm font-medium text-slate-700">
              숙소 선호 <span className="text-slate-400">(선택)</span>
            </label>
            <input
              id={`${id}-hotel`}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              value={accommodationPreference}
              onChange={(e) => setAccommodationPreference(e.target.value)}
              placeholder="예: 4성급 이상, 리조트 선호"
            />
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-etc`} className="block text-sm font-medium text-slate-700">
            기타 요청사항 <span className="text-slate-400">(선택)</span>
          </label>
          <textarea
            id={`${id}-etc`}
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            value={extraRequest}
            onChange={(e) => setExtraRequest(e.target.value)}
            placeholder="차량, 동선, 식사, 일정 관련 요청이 있으면 입력해 주세요"
          />
        </div>
        <p className="text-xs text-slate-500">
          출발 희망일/희망월 중 하나는 반드시 입력해 주세요. 문의 내용에 일정 목적과 요구사항을 남겨 주시면 견적 검토에 반영됩니다.
        </p>
      </div>
    </InquiryFormShell>
  )
}
