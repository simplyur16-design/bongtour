'use client'

import { useCallback, useId, useState } from 'react'
import InquiryFormShell from '@/components/inquiry/InquiryFormShell'
import type { InquiryPageQuery } from '@/lib/inquiry-page'
import type { FieldErrors } from '@/lib/customer-inquiry-intake'

type PreferredContactChannel = 'email' | 'kakao' | 'both'
type Props = {
  initialQuery: InquiryPageQuery
  overlayMeta?: { title: string; description: string } | null
}

export default function BusInquiryForm({ initialQuery, overlayMeta = null }: Props) {
  const id = useId()
  const [organizationName, setOrganizationName] = useState('')
  const [usageType, setUsageType] = useState('')
  const [useDate, setUseDate] = useState('')
  const [targetYearMonth, setTargetYearMonth] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [departurePlace, setDeparturePlace] = useState('')
  const [arrivalPlace, setArrivalPlace] = useState('')
  const [viaPoints, setViaPoints] = useState('')
  const [waitingRequired, setWaitingRequired] = useState(false)
  const [luggageRequired, setLuggageRequired] = useState(false)
  const [estimatedHeadcount, setEstimatedHeadcount] = useState('')
  const [vehicleClassPreference, setVehicleClassPreference] = useState('')
  const [preferredContactChannel, setPreferredContactChannel] = useState<PreferredContactChannel>('both')
  const [extraRequest, setExtraRequest] = useState('')

  const validateBeforeSubmit = useCallback((): { fieldErrors?: FieldErrors; formError?: string } => {
    const fieldErrors: FieldErrors = {}
    const head = parseInt(estimatedHeadcount.replace(/[^\d]/g, ''), 10)
    if (!estimatedHeadcount.trim()) fieldErrors.estimatedHeadcount = '예상 인원을 입력해 주세요.'
    else if (!Number.isFinite(head) || head < 1) fieldErrors.estimatedHeadcount = '예상 인원은 1명 이상의 숫자로 입력해 주세요.'
    if (Object.keys(fieldErrors).length > 0) {
      return { fieldErrors, formError: '필수 입력값을 확인해 주세요.' }
    }
    return {}
  }, [estimatedHeadcount])

  const buildPayloadJson = useCallback(() => {
    const head = parseInt(estimatedHeadcount.replace(/[^\d]/g, ''), 10)
    return {
      consultType: 'CHARTER_BUS',
      quoteKind: 'charter_bus_consult',
      ...(organizationName.trim() ? { organizationName: organizationName.trim() } : {}),
      ...(usageType.trim() ? { usageType: usageType.trim() } : {}),
      ...(useDate.trim() ? { useDate: useDate.trim() } : {}),
      ...(targetYearMonth.trim() ? { targetYearMonth: targetYearMonth.trim() } : {}),
      ...(startTime.trim() ? { startTime: startTime.trim() } : {}),
      ...(endTime.trim() ? { endTime: endTime.trim() } : {}),
      ...(departurePlace.trim() ? { departurePlace: departurePlace.trim() } : {}),
      ...(arrivalPlace.trim() ? { arrivalPlace: arrivalPlace.trim() } : {}),
      ...(viaPoints.trim() ? { viaPoints: viaPoints.trim() } : {}),
      tripType: 'round_trip' as const,
      waitingRequired,
      luggageRequired,
      ...(Number.isFinite(head) && head > 0 ? { estimatedHeadcount: head } : {}),
      ...(vehicleClassPreference.trim() ? { vehicleClassPreference: vehicleClassPreference.trim() } : {}),
      preferredContactChannel,
      ...(extraRequest.trim() ? { extraRequest: extraRequest.trim() } : {}),
    }
  }, [
    arrivalPlace,
    departurePlace,
    endTime,
    estimatedHeadcount,
    extraRequest,
    organizationName,
    preferredContactChannel,
    startTime,
    targetYearMonth,
    usageType,
    useDate,
    vehicleClassPreference,
    viaPoints,
    luggageRequired,
    waitingRequired,
  ])

  return (
    <InquiryFormShell
      kind="bus"
      initialQuery={initialQuery}
      buildPayloadJson={buildPayloadJson}
      beforeSubmit={validateBeforeSubmit}
      applicantNameLabel="담당자 이름"
      applicantEmailRequired
      messageRequired
      messageLabel="문의 내용"
      submitButtonLabel="전세버스 문의 접수하기"
      preferredContactChannel={preferredContactChannel}
      successMessage="문의가 접수되었습니다. 선택하신 답변 방법을 기준으로 순차적으로 안내드리겠습니다."
      successHintMessage={
        preferredContactChannel === 'kakao'
          ? '카카오톡 상담을 원하신 경우, 남겨주신 연락처를 기준으로 확인 후 안내드립니다.'
          : null
      }
      privacyConsentLabel="개인정보 수집·이용 안내를 확인했습니다"
      privacyNoticeVersion="charter-bus-inquiry-v1"
      privacyNoticeTitle="개인정보 수집·이용 안내"
      privacyNoticeContent={
        <div className="space-y-2">
          <p>Bong투어는 전세버스 문의 접수 및 상담 진행을 위해 아래와 같이 개인정보를 수집·이용합니다.</p>
          <p className="font-medium text-slate-800">1. 수집 항목</p>
          <p>
            담당자 이름, 연락처, 이메일, 문의 내용, 예상 인원(왕복 기준), 답변 방법, 일정·노선·차량 관련 항목 중 입력하신 정보,
            기타 직접 입력 정보
          </p>
          <p className="font-medium text-slate-800">2. 수집 및 이용 목적</p>
          <p>전세버스 문의 접수, 문의 내용 확인 및 회신, 선택한 답변 방법(이메일/카카오톡)에 따른 상담 진행, 문의 이력 관리 및 후속 응대</p>
          <p className="font-medium text-slate-800">3. 보유 및 이용 기간</p>
          <p>문의 접수일로부터 1년간 보관 후 파기하며, 관계 법령에 따라 별도 보관이 필요한 경우 해당 법령에 따릅니다.</p>
          <p className="font-medium text-slate-800">4. 문의처</p>
          <p>이메일: bongtour24@naver.com</p>
        </div>
      }
      overlayMeta={overlayMeta}
    >
      <div className="space-y-4">
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white px-3 py-3">
          <h3 className="text-sm font-semibold text-slate-800">이용 조건</h3>
          <div>
            <label htmlFor={`${id}-pax`} className="block text-sm font-medium text-slate-700">
              예상 인원 <span className="text-rose-600">*</span>
              <span className="ml-1 font-normal text-slate-400">(왕복 기준)</span>
            </label>
            <input
              id={`${id}-pax`}
              name="estimatedHeadcount"
              type="number"
              min={1}
              inputMode="numeric"
              value={estimatedHeadcount}
              onChange={(e) => setEstimatedHeadcount(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
            <p className="mt-1.5 text-xs text-slate-500">전세버스 문의는 왕복 운행을 기준으로 접수합니다.</p>
          </div>
          <div>
            <label htmlFor={`${id}-preferred-contact`} className="block text-sm font-medium text-slate-700">
              답변받을 방법 <span className="text-slate-400">(선택)</span>
            </label>
            <select
              id={`${id}-preferred-contact`}
              value={preferredContactChannel}
              onChange={(e) => setPreferredContactChannel(e.target.value as PreferredContactChannel)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="email">이메일로 답변받기</option>
              <option value="kakao">카카오톡으로 상담받기</option>
              <option value="both">둘 다 가능</option>
            </select>
            {preferredContactChannel === 'kakao' ? (
              <p className="mt-1.5 text-xs text-slate-500">
                카카오톡 상담을 원하시면 연락 가능한 번호를 정확히 남겨주세요. 확인 후 순차적으로 안내드립니다.
              </p>
            ) : null}
          </div>
        </section>

        <details className="rounded-lg border border-slate-200 bg-white [&_summary::-webkit-details-marker]:hidden">
          <summary className="cursor-pointer list-none px-3 py-3 text-sm font-semibold text-slate-800 outline-none ring-emerald-600 focus-visible:ring-2">
            추가정보 입력(선택)
          </summary>
          <div className="space-y-4 border-t border-slate-100 px-3 pb-4 pt-3">
            <p className="text-xs leading-relaxed text-slate-600">
              아래 정보는 미정이어도 접수 가능합니다. 자세한 일정과 차량 조건은 상담하면서 안내해드립니다.
            </p>
            <div>
              <label htmlFor={`${id}-org`} className="block text-sm font-medium text-slate-700">
                단체명 / 기관명 / 회사명 <span className="text-slate-400">(선택)</span>
              </label>
              <input
                id={`${id}-org`}
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label htmlFor={`${id}-purpose`} className="block text-sm font-medium text-slate-700">
                이용 목적 <span className="text-slate-400">(선택)</span>
              </label>
              <select
                id={`${id}-purpose`}
                value={usageType}
                onChange={(e) => setUsageType(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="">선택 안 함</option>
                <option value="기업/기관 이동">기업/기관 이동</option>
                <option value="학교/학원 일정">학교/학원 일정</option>
                <option value="행사/모임 이동">행사/모임 이동</option>
                <option value="관광/자유 일정 이동">관광/자유 일정 이동</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">이용 일정 · 동선</h4>
              <div className="mt-2 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-date`} className="block text-sm font-medium text-slate-700">
                이용 날짜 <span className="text-slate-400">(선택)</span>
              </label>
              <input
                id={`${id}-date`}
                type="date"
                value={useDate}
                onChange={(e) => setUseDate(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label htmlFor={`${id}-ym`} className="block text-sm font-medium text-slate-700">
                이용 희망 월 <span className="text-slate-400">(선택)</span>
              </label>
              <input
                id={`${id}-ym`}
                name="targetYearMonth"
                type="month"
                value={targetYearMonth}
                onChange={(e) => setTargetYearMonth(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-start-time`} className="block text-sm font-medium text-slate-700">
                출발 시간 <span className="text-slate-400">(선택)</span>
              </label>
              <input
                id={`${id}-start-time`}
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label htmlFor={`${id}-end-time`} className="block text-sm font-medium text-slate-700">
                종료 예상 시간 <span className="text-slate-400">(선택)</span>
              </label>
              <input
                id={`${id}-end-time`}
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>
          <div>
            <label htmlFor={`${id}-from`} className="block text-sm font-medium text-slate-700">
              출발지 <span className="text-slate-400">(선택)</span>
            </label>
            <input
              id={`${id}-from`}
              name="departurePlace"
              type="text"
              value={departurePlace}
              onChange={(e) => setDeparturePlace(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label htmlFor={`${id}-to`} className="block text-sm font-medium text-slate-700">
              도착지 <span className="text-slate-400">(선택)</span>
            </label>
            <input
              id={`${id}-to`}
              name="arrivalPlace"
              type="text"
              value={arrivalPlace}
              onChange={(e) => setArrivalPlace(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label htmlFor={`${id}-via`} className="block text-sm font-medium text-slate-700">
              경유지 <span className="text-slate-400">(선택)</span>
            </label>
            <input
              id={`${id}-via`}
              name="viaPoints"
              type="text"
              value={viaPoints}
              onChange={(e) => setViaPoints(e.target.value)}
              placeholder="예: 판교역, 수원시청"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">차량 · 기타 조건</h4>
          <label className="flex gap-2 text-sm text-slate-700">
            <input
              id={`${id}-wait`}
              name="waitingRequired"
              type="checkbox"
              checked={waitingRequired}
              onChange={(e) => setWaitingRequired(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
            />
            기사 대기 시간이 필요합니다
          </label>
          <label className="flex gap-2 text-sm text-slate-700">
            <input
              id={`${id}-luggage`}
              name="luggageRequired"
              type="checkbox"
              checked={luggageRequired}
              onChange={(e) => setLuggageRequired(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
            />
            짐 적재가 필요한 일정입니다
          </label>
          <div>
            <label htmlFor={`${id}-veh`} className="block text-sm font-medium text-slate-700">
              희망 차량 종류 <span className="text-slate-400">(선택)</span>
            </label>
            <select
              id={`${id}-veh`}
              value={vehicleClassPreference}
              onChange={(e) => setVehicleClassPreference(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="">선택 안 함</option>
              <option value="25인승">25인승</option>
              <option value="28인승">28인승</option>
              <option value="45인승">45인승</option>
              <option value="기타">기타</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-extra`} className="block text-sm font-medium text-slate-700">
              추가 요청사항 <span className="text-slate-400">(선택)</span>
            </label>
            <textarea
              id={`${id}-extra`}
              rows={3}
              value={extraRequest}
              onChange={(e) => setExtraRequest(e.target.value)}
              placeholder="대기 장소, 짐 적재, 기사 연락 방식 등"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
            </div>
          </div>
        </details>
      </div>
    </InquiryFormShell>
  )
}
