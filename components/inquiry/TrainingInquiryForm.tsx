'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import InquiryFormShell from '@/components/inquiry/InquiryFormShell'
import type { FieldErrors } from '@/lib/customer-inquiry-intake'
import type { InquiryPageQuery } from '@/lib/inquiry-page'

export const TRAINING_SERVICE_OPTIONS = [
  '연수기관 섭외만',
  '연수기획·진행 및 연수기관 섭외',
  '연수기획·진행만',
  '순차통역만',
] as const
const TRAINING_PRIVACY_NOTICE_VERSION = 'training-inquiry-v1'

type TrainingServiceOption = (typeof TRAINING_SERVICE_OPTIONS)[number]
type PreferredContactChannel = 'email' | 'kakao' | 'both'

type Props = {
  initialQuery: InquiryPageQuery
  presetService?: TrainingServiceOption | null
  overlayMeta?: { title: string; description: string } | null
  serviceBadgeLabel?: string | null
}

export default function TrainingInquiryForm({
  initialQuery,
  presetService = null,
  overlayMeta = null,
  serviceBadgeLabel = null,
}: Props) {
  const id = useId()
  const [organizationName, setOrganizationName] = useState('')
  const [organizationType, setOrganizationType] = useState('')
  const [destinationSummary, setDestinationSummary] = useState('')
  const [preferredDepartureDate, setPreferredDepartureDate] = useState('')
  const [preferredDepartureMonth, setPreferredDepartureMonth] = useState(initialQuery.targetYearMonth ?? '')
  const [durationDays, setDurationDays] = useState('')
  const [headcount, setHeadcount] = useState('')
  const [departureArea, setDepartureArea] = useState('')
  const [trainingPurpose, setTrainingPurpose] = useState('')
  const [trainingTheme, setTrainingTheme] = useState('')
  const initialServiceScope = (() => {
    const raw = (presetService ?? initialQuery.trainingServiceScope ?? '').trim()
    return TRAINING_SERVICE_OPTIONS.includes(raw as TrainingServiceOption) ? (raw as TrainingServiceOption) : ''
  })()
  const [serviceScope, setServiceScope] = useState<TrainingServiceOption | ''>(initialServiceScope)
  const [requestedVisitTypes, setRequestedVisitTypes] = useState('')
  const [participantType, setParticipantType] = useState('')
  const [preferredContactChannel, setPreferredContactChannel] = useState<PreferredContactChannel>('both')
  const [budgetNote, setBudgetNote] = useState('')
  const [includeFlight, setIncludeFlight] = useState('')
  const [interpreterNeeded, setInterpreterNeeded] = useState(false)
  const [vehicleNeeded, setVehicleNeeded] = useState(false)
  const [accommodationNeeded, setAccommodationNeeded] = useState(false)
  const [seminarNeeded, setSeminarNeeded] = useState(false)
  const [institutionVisitNeeded, setInstitutionVisitNeeded] = useState(false)
  const [extraRequest, setExtraRequest] = useState('')

  useEffect(() => {
    const raw = (presetService ?? initialQuery.trainingServiceScope ?? '').trim()
    if (TRAINING_SERVICE_OPTIONS.includes(raw as TrainingServiceOption)) {
      setServiceScope(raw as TrainingServiceOption)
    }
  }, [initialQuery.trainingServiceScope, presetService])

  const validateBeforeSubmit = useCallback((): { fieldErrors?: FieldErrors; formError?: string } => {
    const fieldErrors: FieldErrors = {}
    if (!serviceScope) fieldErrors.serviceScope = '필요한 서비스 범위를 선택해 주세요.'
    if (Object.keys(fieldErrors).length > 0) {
      return { fieldErrors, formError: '필수 입력값을 확인해 주세요.' }
    }
    return {}
  }, [serviceScope])

  const buildPayloadJson = useCallback(() => {
    const head = parseInt(headcount.replace(/[^\d]/g, ''), 10)
    const duration = parseInt(durationDays.replace(/[^\d]/g, ''), 10)
    return {
      consultType: 'OVERSEAS_TRAINING',
      quoteKind: 'overseas_training_consult',
      serviceDomain: 'overseas_training',
      ...(organizationName.trim() ? { organizationName: organizationName.trim() } : {}),
      ...(organizationType.trim() ? { organizationType: organizationType.trim() } : {}),
      ...(serviceScope ? { serviceScope } : {}),
      ...(destinationSummary.trim() ? { destinationSummary: destinationSummary.trim() } : {}),
      ...(preferredDepartureDate.trim() ? { preferredDepartureDate: preferredDepartureDate.trim() } : {}),
      ...(preferredDepartureMonth.trim() ? { preferredDepartureMonth: preferredDepartureMonth.trim() } : {}),
      ...(Number.isFinite(duration) && duration > 0 ? { durationDays: duration } : {}),
      ...(Number.isFinite(head) && head > 0 ? { headcount: head } : {}),
      ...(departureArea.trim() ? { departureArea: departureArea.trim() } : {}),
      ...(trainingPurpose.trim() ? { trainingPurpose: trainingPurpose.trim() } : {}),
      ...(trainingTheme.trim() ? { trainingTheme: trainingTheme.trim() } : {}),
      ...(requestedVisitTypes.trim() ? { requestedVisitTypes: requestedVisitTypes.trim() } : {}),
      ...(participantType.trim() ? { participantType: participantType.trim() } : {}),
      preferredContactChannel,
      ...(budgetNote.trim() ? { budgetNote: budgetNote.trim() } : {}),
      ...(includeFlight.trim() ? { includeFlight: includeFlight.trim() } : {}),
      institutionVisitNeeded,
      interpreterNeeded,
      vehicleNeeded,
      accommodationNeeded,
      seminarNeeded,
      ...(extraRequest.trim() ? { extraRequest: extraRequest.trim() } : {}),
    }
  }, [
    accommodationNeeded,
    budgetNote,
    departureArea,
    destinationSummary,
    durationDays,
    extraRequest,
    headcount,
    includeFlight,
    institutionVisitNeeded,
    interpreterNeeded,
    organizationName,
    organizationType,
    participantType,
    preferredContactChannel,
    preferredDepartureDate,
    preferredDepartureMonth,
    requestedVisitTypes,
    serviceScope,
    seminarNeeded,
    trainingPurpose,
    trainingTheme,
    vehicleNeeded,
  ])

  return (
    <InquiryFormShell
      kind="training"
      initialQuery={initialQuery}
      buildPayloadJson={buildPayloadJson}
      beforeSubmit={validateBeforeSubmit}
      applicantNameLabel="담당자 이름"
      applicantEmailRequired
      messageRequired
      messageLabel="문의 내용"
      submitButtonLabel="국외연수 문의 접수하기"
      preferredContactChannel={preferredContactChannel}
      successMessage="문의가 접수되었습니다. 선택하신 답변 방법을 기준으로 순차적으로 안내드리겠습니다."
      successHintMessage={
        preferredContactChannel === 'kakao'
          ? '카카오톡 상담을 원하신 경우, 남겨주신 연락처를 기준으로 확인 후 안내드립니다.'
          : null
      }
      privacyConsentLabel="개인정보 수집·이용 안내를 확인했습니다"
      privacyNoticeVersion={TRAINING_PRIVACY_NOTICE_VERSION}
      privacyNoticeTitle="개인정보 수집·이용 안내"
      privacyNoticeContent={
        <div className="space-y-2">
          <p>Bong투어는 국외연수 문의 접수 및 상담 진행을 위해 아래와 같이 개인정보를 수집·이용합니다.</p>
          <p className="font-medium text-slate-800">1. 수집 항목</p>
          <p>
            담당자 이름, 연락처, 이메일, 필요한 서비스, 문의 내용, 답변 방법, 기관·일정 관련 항목 중 입력하신 정보, 기타 직접
            입력 정보
          </p>
          <p className="font-medium text-slate-800">2. 수집 및 이용 목적</p>
          <p>국외연수 문의 접수, 문의 내용 확인 및 회신, 서비스 제공 가능 여부 검토, 맞춤형 상담 및 제안, 선택한 답변 방법(이메일/카카오톡)에 따른 상담 진행, 문의 이력 관리 및 후속 응대</p>
          <p className="font-medium text-slate-800">3. 처리의 근거</p>
          <p>정보주체의 상담 요청에 따른 문의 접수 및 상담 진행, 개인정보 보호법 등 관련 법령이 허용하는 범위 내 처리</p>
          <p className="font-medium text-slate-800">4. 보유 및 이용 기간</p>
          <p>문의 접수일로부터 1년간 보관 후 파기하며, 관계 법령에 따라 별도 보관이 필요한 경우 해당 법령에 따릅니다.</p>
          <p className="font-medium text-slate-800">5. 이용자 안내</p>
          <p>개인정보 처리 안내를 확인할 권리가 있으며, 상담에 필요한 최소 정보가 제공되지 않으면 상담 진행이 제한될 수 있습니다.</p>
          <p className="font-medium text-slate-800">6. 문의처</p>
          <p>이메일: bongtour24@naver.com</p>
        </div>
      }
      overlayMeta={
        overlayMeta ?? {
          title: '국외연수 문의하기',
          description:
            '연락처와 필요 서비스만으로도 상담 접수가 가능합니다. 일정·지역·인원은 상담 단계에서 함께 정리하셔도 됩니다.',
        }
      }
    >
      <div className="space-y-4">
        {serviceBadgeLabel ? (
          <section className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
            <p className="text-xs font-semibold text-blue-900">선택한 서비스</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{serviceBadgeLabel}</p>
          </section>
        ) : null}
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white px-3 py-3">
          <h3 className="text-sm font-semibold text-slate-800">문의 조건</h3>
          <div>
            <label htmlFor={`${id}-service-scope`} className="block text-sm font-medium text-slate-700">
              필요한 서비스 <span className="text-rose-600">*</span>
            </label>
            <select
              id={`${id}-service-scope`}
              value={serviceScope}
              onChange={(e) => setServiceScope(e.target.value as TrainingServiceOption | '')}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="">서비스 범위를 선택해 주세요</option>
              {TRAINING_SERVICE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
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
                카카오톡 상담을 원하시면 문의 접수 후 오픈카카오톡으로도 상담을 이어가실 수 있습니다.
              </p>
            ) : preferredContactChannel === 'both' ? (
              <p className="mt-1.5 text-xs text-slate-500">카카오톡 상담을 원하시면 문의 접수 후 오픈카카오톡으로도 상담을 이어가실 수 있습니다.</p>
            ) : (
              <p className="mt-1.5 text-xs text-slate-500">이메일 회신 중심으로 안내드립니다.</p>
            )}
          </div>
          <div>
            <label htmlFor={`${id}-org-type`} className="block text-sm font-medium text-slate-700">
              기관 유형 <span className="text-slate-400">(선택)</span>
            </label>
            <select
              id={`${id}-org-type`}
              value={organizationType}
              onChange={(e) => setOrganizationType(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="">선택 안 함</option>
              <option value="school">학교</option>
              <option value="public">공공기관</option>
              <option value="corporate">기업</option>
              <option value="other">기타</option>
            </select>
          </div>
        </section>

        <details className="rounded-lg border border-slate-200 bg-white [&_summary::-webkit-details-marker]:hidden">
          <summary className="cursor-pointer list-none px-3 py-3 text-sm font-semibold text-slate-800 outline-none ring-emerald-600 focus-visible:ring-2">
            추가정보 입력(선택)
          </summary>
          <div className="space-y-4 border-t border-slate-100 px-3 pb-4 pt-3">
            <p className="text-xs leading-relaxed text-slate-600">
              아래 정보는 미정이어도 접수 가능합니다. 자세한 내용은 상담하면서 함께 정리해드립니다.
            </p>
            <div>
              <label htmlFor={`${id}-org`} className="block text-sm font-medium text-slate-700">
                기관명 / 학교명 / 단체명 <span className="text-slate-400">(선택)</span>
              </label>
              <input
                id={`${id}-org`}
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">연수 일정·조건</h4>
              <div className="mt-2 space-y-3">
          <div>
            <label htmlFor={`${id}-dest`} className="block text-sm font-medium text-slate-700">
              희망 국가 또는 도시 <span className="text-slate-400">(선택)</span>
            </label>
            <input
              id={`${id}-dest`}
              value={destinationSummary}
              onChange={(e) => setDestinationSummary(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-dep-date`} className="block text-sm font-medium text-slate-700">
                출발 희망일 <span className="text-slate-400">(선택)</span>
              </label>
              <input
                id={`${id}-dep-date`}
                type="date"
                value={preferredDepartureDate}
                onChange={(e) => setPreferredDepartureDate(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label htmlFor={`${id}-dep-month`} className="block text-sm font-medium text-slate-700">
                출발 희망월 <span className="text-slate-400">(선택)</span>
              </label>
              <input
                id={`${id}-dep-month`}
                type="month"
                value={preferredDepartureMonth}
                onChange={(e) => setPreferredDepartureMonth(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor={`${id}-days`} className="block text-sm font-medium text-slate-700">
                희망 일정 일수 <span className="text-slate-400">(권장)</span>
              </label>
              <input
                id={`${id}-days`}
                inputMode="numeric"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="예: 5"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label htmlFor={`${id}-headcount`} className="block text-sm font-medium text-slate-700">
                예상 인원 <span className="text-slate-400">(선택)</span>
              </label>
              <input
                id={`${id}-headcount`}
                inputMode="numeric"
                value={headcount}
                onChange={(e) => setHeadcount(e.target.value)}
                placeholder="예: 30"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label htmlFor={`${id}-dep-area`} className="block text-sm font-medium text-slate-700">
                출발 지역 <span className="text-slate-400">(선택)</span>
              </label>
              <input
                id={`${id}-dep-area`}
                value={departureArea}
                onChange={(e) => setDepartureArea(e.target.value)}
                placeholder="예: 인천, 부산"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">연수 내용 · 목적</h4>
          <div>
            <label htmlFor={`${id}-purpose`} className="block text-sm font-medium text-slate-700">
              연수 목적 <span className="text-slate-400">(선택)</span>
            </label>
            <textarea
              id={`${id}-purpose`}
              rows={3}
              value={trainingPurpose}
              onChange={(e) => setTrainingPurpose(e.target.value)}
              placeholder="예: 교육과정 벤치마킹 및 기관 교류"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-theme`} className="block text-sm font-medium text-slate-700">
                희망 연수 주제 <span className="text-slate-400">(권장)</span>
              </label>
              <input
                id={`${id}-theme`}
                value={trainingTheme}
                onChange={(e) => setTrainingTheme(e.target.value)}
                placeholder="예: 교육행정, 스마트시티, ESG"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label htmlFor={`${id}-participant`} className="block text-sm font-medium text-slate-700">
                참가 대상 <span className="text-slate-400">(권장)</span>
              </label>
              <select
                id={`${id}-participant`}
                value={participantType}
                onChange={(e) => setParticipantType(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="">선택 안 함</option>
                <option value="student">학생</option>
                <option value="faculty">교직원</option>
                <option value="public_officer">공무원</option>
                <option value="employee">임직원</option>
                <option value="other">기타</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor={`${id}-visit`} className="block text-sm font-medium text-slate-700">
              방문 희망 기관 유형 <span className="text-slate-400">(권장)</span>
            </label>
            <input
              id={`${id}-visit`}
              value={requestedVisitTypes}
              onChange={(e) => setRequestedVisitTypes(e.target.value)}
              placeholder="예: 대학교, 공공기관, 기업 연구소"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-medium text-slate-600">운영 지원 필요 항목</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={seminarNeeded} onChange={(e) => setSeminarNeeded(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
                세미나/특강 섭외 필요
              </label>
              <label className="flex gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={institutionVisitNeeded} onChange={(e) => setInstitutionVisitNeeded(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
                기관 방문 섭외 필요
              </label>
              <label className="flex gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={interpreterNeeded} onChange={(e) => setInterpreterNeeded(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
                통역 필요
              </label>
              <label className="flex gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={vehicleNeeded} onChange={(e) => setVehicleNeeded(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
                버스/현지 이동 필요
              </label>
            </div>
          </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">예산 · 기타</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-budget`} className="block text-sm font-medium text-slate-700">
                예상 예산 범위 <span className="text-slate-400">(권장)</span>
              </label>
              <input
                id={`${id}-budget`}
                value={budgetNote}
                onChange={(e) => setBudgetNote(e.target.value)}
                placeholder="예: 1인당 200만원 내외"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label htmlFor={`${id}-flight`} className="block text-sm font-medium text-slate-700">
                항공 포함 여부 <span className="text-slate-400">(선택)</span>
              </label>
              <select
                id={`${id}-flight`}
                value={includeFlight}
                onChange={(e) => setIncludeFlight(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="">선택 안 함</option>
                <option value="include">포함 희망</option>
                <option value="exclude">불포함 희망</option>
              </select>
            </div>
          </div>
          <label className="flex gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={accommodationNeeded} onChange={(e) => setAccommodationNeeded(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
            숙박 필요
          </label>
          <div>
            <label htmlFor={`${id}-etc`} className="block text-sm font-medium text-slate-700">
              기타 요청사항 <span className="text-slate-400">(선택)</span>
            </label>
            <textarea
              id={`${id}-etc`}
              rows={3}
              value={extraRequest}
              onChange={(e) => setExtraRequest(e.target.value)}
              placeholder="이전 유사 연수 경험, 참고사항 등을 입력해 주세요"
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
