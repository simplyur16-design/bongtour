'use client'

import { readAdminResponseJson } from '@/lib/admin/read-admin-response-json'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { formatKRW } from '@/lib/price-utils'
import type { ConsultIntakeInquiry, ConsultIntakeItem } from '@/lib/admin-consult-intake'
import AdminEmptyState from '../components/AdminEmptyState'
import AdminKpiCard from '../components/AdminKpiCard'
import AdminPageHeader from '../components/AdminPageHeader'
import AdminStatusBadge from '../components/AdminStatusBadge'
import TestIntakeAdminTools, {
  intakeSelectionKey,
  useAdminIntakeDelete,
  type IntakeDeleteRow,
} from '@/components/admin/TestIntakeAdminTools'
import { getNextBookingStatuses } from '@/lib/booking-status-policy'

type IntakeSelection =
  | { kind: 'booking'; id: number }
  | { kind: 'inquiry'; id: string }
  | null

type Booking = {
  id: number
  bookingNumber: string
  productId: string
  productTitle: string
  selectedDate: string
  pricingMode?: string | null
  adultCount: number
  childBedCount: number
  childNoBedCount: number
  infantCount: number
  totalKrwAmount: number
  totalLocalAmount: number
  localCurrency: string
  customerName: string
  customerNameKo?: string | null
  customerNameEn?: string | null
  customerBirthDate?: string | null
  customerPhone: string
  customerEmail: string | null
  privacyAgreed?: boolean | null
  privacyAgreedAt?: string | null
  marketingConsent?: boolean | null
  marketingConsentAt?: string | null
  marketingConsentVersion?: string | null
  requestNotes?: string | null
  preferredContactChannel?: string | null
  singleRoomRequested?: boolean
  childInfantBirthDatesJson?: string | null
  status: string
  notificationStatus: string | null
  notificationError: string | null
  createdAt: string
  product?: { id: string; title: string; originCode: string }
}

const STATUS_TO_VARIANT: Record<string, 'received' | 'consulting' | 'confirmed' | 'cancelled'> = {
  접수완료: 'received',
  상담중: 'consulting',
  예약확정: 'confirmed',
  취소: 'cancelled',
}

export default function AdminBookingsPage() {
  const [bookingRows, setBookingRows] = useState<Booking[]>([])
  const [intakeItems, setIntakeItems] = useState<ConsultIntakeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selection, setSelection] = useState<IntakeSelection>(null)
  const [detail, setDetail] = useState<Booking | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(() => new Set())
  const { deleteOne, deleteSelected, busy: deleteBusy, error: deleteError, setError: setDeleteError } =
    useAdminIntakeDelete(() => {
      setSelection(null)
      setDetail(null)
      setCheckedKeys(new Set())
      setLoading(true)
      fetchList()
    })

  const toggleChecked = (item: ConsultIntakeItem, on: boolean) => {
    const key = intakeSelectionKey(item.kind, item.id)
    setCheckedKeys((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const checkedRows = useMemo((): IntakeDeleteRow[] => {
    return intakeItems
      .filter((item) => checkedKeys.has(intakeSelectionKey(item.kind, item.id)))
      .map((item) => ({
        kind: item.kind,
        id: item.id,
        accessionNumber: item.accessionNumber,
        isTest: item.isTest,
      }))
  }, [intakeItems, checkedKeys])

  const allVisibleChecked =
    intakeItems.length > 0 && intakeItems.every((i) => checkedKeys.has(intakeSelectionKey(i.kind, i.id)))

  const fetchList = useCallback(() => {
    fetch('/api/admin/bookings')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBookingRows(data)
          setIntakeItems([])
          return
        }
        setBookingRows(Array.isArray(data.bookings) ? data.bookings : [])
        setIntakeItems(Array.isArray(data.intakeItems) ? data.intakeItems : [])
      })
      .catch(() => {
        setBookingRows([])
        setIntakeItems([])
      })
      .finally(() => setLoading(false))
  }, [])

  const selectedInquiry = useMemo((): ConsultIntakeInquiry | null => {
    if (selection?.kind !== 'inquiry') return null
    const row = intakeItems.find((i) => i.kind === 'inquiry' && i.id === selection.id)
    return row?.kind === 'inquiry' ? row : null
  }, [intakeItems, selection])

  const selectedIntake = useMemo(() => {
    if (!selection) return null
    return intakeItems.find((i) => i.kind === selection.kind && i.id === selection.id) ?? null
  }, [intakeItems, selection])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  useEffect(() => {
    setStatusError(null)
    if (selection?.kind !== 'booking') {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    fetch(`/api/admin/bookings/${selection.id}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }, [selection])

  const updateStatus = async (id: number, status: string) => {
    setUpdating(true)
    setStatusError(null)
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = (await readAdminResponseJson(res).catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setStatusError(data.error ?? '상태 변경 실패')
        return
      }
      setDetail((d) => (d && d.id === id ? { ...d, status } : d))
      setBookingRows((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)))
      setIntakeItems((prev) =>
        prev.map((i) =>
          i.kind === 'booking' && i.id === id ? { ...i, status } : i,
        ),
      )
    } finally {
      setUpdating(false)
    }
  }

  const consultingCount = bookingRows.filter((b) => b.status === '상담중').length
  const confirmedCount = bookingRows.filter((b) => b.status === '예약확정').length
  const inquiryCount = intakeItems.filter((i) => i.kind === 'inquiry').length
  const bookingIntakeCount = intakeItems.filter((i) => i.kind === 'booking').length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-4">
          <Link href="/admin" className="text-sm text-gray-500 hover:text-[#0f172a]">← 대시보드</Link>
        </div>
        <AdminPageHeader
          title="상담·예약"
          subtitle="홈·상품 여행 상담(문의)과 패키지 예약 신청을 한곳에서 관리합니다. 목록에서 선택 후 삭제할 수 있으며, 삭제된 접수는 복구되지 않습니다."
        />

        <TestIntakeAdminTools
          onPurged={() => {
            setSelection(null)
            setDetail(null)
            setLoading(true)
            fetchList()
          }}
        />

        {/* KPI */}
        {!loading && (
          <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <AdminKpiCard label="전체 접수" value={`${intakeItems.length}건`} tone="muted" />
            <AdminKpiCard label="여행 상담" value={`${inquiryCount}건`} tone="muted" />
            <AdminKpiCard label="패키지 예약" value={`${bookingIntakeCount}건`} tone="muted" />
            <AdminKpiCard label="상담중(예약)" value={`${consultingCount}건`} tone="muted" />
            <AdminKpiCard label="확정(예약)" value={`${confirmedCount}건`} tone="muted" />
          </section>
        )}

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="border-l-4 border-[#0f172a] pl-3 text-base font-semibold text-[#0f172a]">
              통합 접수 목록 (최신순)
            </h2>
            {!loading && intakeItems.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-gray-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={allVisibleChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCheckedKeys(
                          new Set(intakeItems.map((i) => intakeSelectionKey(i.kind, i.id))),
                        )
                      } else {
                        setCheckedKeys(new Set())
                      }
                    }}
                  />
                  전체 선택
                </label>
                {checkedRows.length > 0 ? (
                  <button
                    type="button"
                    disabled={deleteBusy}
                    onClick={() => {
                      setDeleteError(null)
                      void deleteSelected(checkedRows)
                    }}
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                  >
                    {deleteBusy ? '삭제 중…' : `선택 삭제 (${checkedRows.length}건)`}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {deleteError && !selection ? (
            <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {deleteError}
            </p>
          ) : null}
          {loading ? (
            <div className="flex justify-center py-12 text-gray-500">로딩 중…</div>
          ) : intakeItems.length === 0 ? (
            <AdminEmptyState
              title="접수 내역이 없습니다"
              description="헤더 「상담 신청」·상품 상세 예약 신청이 접수되면 여기에 표시됩니다."
              actionLabel="대시보드"
              actionHref="/admin"
            />
          ) : (
            <ul className="divide-y divide-gray-100 md:divide-y" data-admin-mobile-bookings="true">
              {/* REGRESSION-FREEZE[admin-mobile-ops-b-register]: bookings mobile list — manifest */}
              {intakeItems.map((item) => {
                const isSelected =
                  selection?.kind === item.kind &&
                  (item.kind === 'booking' ? selection.id === item.id : selection.id === item.id)
                const rowKey = intakeSelectionKey(item.kind, item.id)
                const isChecked = checkedKeys.has(rowKey)
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    <div
                      className={`flex w-full items-start gap-3 py-3 md:items-center ${isSelected ? 'bg-gray-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="ml-1 mt-1 h-5 w-5 shrink-0 rounded border-gray-300 md:mt-0 md:h-4 md:w-4"
                        checked={isChecked}
                        aria-label={`${item.accessionNumber} 선택`}
                        onChange={(e) => toggleChecked(item, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setSelection(
                            item.kind === 'booking'
                              ? { kind: 'booking', id: item.id }
                              : { kind: 'inquiry', id: item.id },
                          )
                        }
                        className="flex min-h-12 min-w-0 flex-1 flex-col gap-2 text-left hover:opacity-90 md:min-h-0 md:flex-row md:items-center md:justify-between"
                      >
                      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            item.kind === 'inquiry'
                              ? 'bg-[#EFEDF8] text-[#1F1B2D]'
                              : 'bg-emerald-50 text-emerald-900'
                          }`}
                        >
                          {item.kind === 'inquiry' ? '여행상담' : '패키지예약'}
                        </span>
                        <span className="rounded border border-gray-200 px-2 py-0.5 font-mono text-xs font-medium text-gray-800">
                          {item.accessionNumber}
                        </span>
                        {item.isTest ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                            테스트
                          </span>
                        ) : null}
                        <AdminStatusBadge
                          variant={
                            item.kind === 'booking'
                              ? STATUS_TO_VARIANT[item.status] ?? 'received'
                              : 'received'
                          }
                          label={item.kind === 'booking' ? item.status : item.statusLabel}
                        />
                        </div>
                        <span className="font-medium text-[#0f172a]">{item.productTitle}</span>
                        <span className="text-sm text-gray-600">{item.customerName}</span>
                        {item.kind === 'booking' ? (
                          <span className="text-sm text-gray-500">
                            {new Date(item.selectedDate).toLocaleDateString('ko-KR')} 출발
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">{item.inquiryTypeLabel}</span>
                        )}
                      </div>
                    </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {selection?.kind === 'inquiry' && selectedInquiry ? (
          <section className="mt-6 rounded-xl border border-[#EFEDF8] bg-white p-5 shadow-sm">
            <h2 className="mb-4 border-l-4 border-[#d9a81e] pl-3 text-base font-semibold text-[#0f172a]">
              여행 상담 상세
            </h2>
            <dl className="grid gap-3 text-sm text-gray-700">
              <div>
                <dt className="text-xs text-gray-500">접수번호</dt>
                <dd className="font-mono font-semibold">{selectedInquiry.accessionNumber}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">고객</dt>
                <dd>
                  {selectedInquiry.customerName} · {selectedInquiry.applicantPhone}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">상품</dt>
                <dd>{selectedInquiry.productTitle}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">문의 내용</dt>
                <dd className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3">
                  {selectedInquiry.message?.trim() || '(본문 없음)'}
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/admin/inquiries/${selectedInquiry.id}`}
                className="rounded-lg bg-[#1F1B2D] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                문의 전체 상세 · 상태 변경
              </Link>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => {
                  setDeleteError(null)
                  void deleteOne(
                    'inquiry',
                    selectedInquiry.id,
                    selectedInquiry.accessionNumber,
                    selectedInquiry.isTest,
                  )
                }}
                className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
              >
                {selectedInquiry.isTest ? '테스트 문의 삭제' : '문의 삭제'}
              </button>
            </div>
          </section>
        ) : null}

        {/* 패키지 예약 상세 (선택 시) */}
        {selection?.kind === 'booking' && (
          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 border-l-4 border-[#0f172a] pl-3 text-base font-semibold text-[#0f172a]">상담·예약 상세</h2>
            {detailLoading ? (
              <div className="flex justify-center py-8">
                <p className="text-sm font-medium text-gray-500">로딩 중...</p>
              </div>
            ) : detail ? (
              <div className="space-y-6">
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-600">접수번호</h3>
                  <p className="font-mono text-base font-semibold text-[#0f172a]">{detail.bookingNumber}</p>
                  <p className="mt-1 text-xs text-gray-400">내부 id · {detail.id}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="border border-gray-200 bg-gray-50 p-4">
                    <h3 className="mb-2 border-l-4 border-[#0f172a] pl-2 text-sm font-semibold text-[#0f172a]">인원 구성</h3>
                    <p className="text-sm text-gray-600">
                      성인 {detail.adultCount} / 아동(베드) {detail.childBedCount} / 아동(노베드){' '}
                      {detail.childNoBedCount} / 유아 {detail.infantCount}
                    </p>
                  </div>
                  <div className="border border-gray-200 bg-gray-50 p-4">
                    <h3 className="mb-2 border-l-4 border-[#0f172a] pl-2 text-sm font-semibold text-[#0f172a]">기준 출발일</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(detail.selectedDate).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                {detail.pricingMode === 'wish_date_only' && (
                  <p className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-sm text-amber-900">
                    이 접수는 희망 출발일 기준으로 접수되었습니다. 금액은 담당자 확인 후 안내됩니다.
                  </p>
                )}
                {detail.pricingMode === 'schedule_selected_pending_quote' && (
                  <p className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-sm text-amber-900">
                    선택 출발일은 저장되었으나 해당 일자 요금 행이 없어 견적 금액은 0으로 접수되었습니다. 담당자 확인 후 안내해 주세요.
                  </p>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-600">선호 연락</h3>
                    <p>
                      {detail.preferredContactChannel === 'kakao'
                        ? '카카오'
                        : detail.preferredContactChannel === 'email'
                          ? '이메일'
                          : '전화'}
                    </p>
                    {detail.singleRoomRequested && (
                      <p className="mt-2 text-amber-800">1인실 요청 있음</p>
                    )}
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-600">아동·유아 생년월일</h3>
                    <p className="font-mono text-xs text-gray-600 break-all">
                      {detail.childInfantBirthDatesJson
                        ? detail.childInfantBirthDatesJson
                        : '—'}
                    </p>
                  </div>
                </div>

                {detail.requestNotes && (
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-600">요청사항</h3>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{detail.requestNotes}</p>
                  </div>
                )}

                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">예상가/참고가(변동 가능) (원화 + 현지 외화)</h3>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-gray-600">한국 지불 예정액:</span>{' '}
                      <span className="font-semibold text-gray-900">
                        {formatKRW(detail.totalKrwAmount)}
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-600">현지 지불 예정액:</span>{' '}
                      <span className="font-semibold text-amber-800">
                        {detail.localCurrency} {detail.totalLocalAmount.toLocaleString()}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">신청자 정보</h3>
                  <dl className="space-y-1 text-sm text-gray-700">
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-gray-500">한글 이름</dt>
                      <dd>{detail.customerNameKo ?? detail.customerName}</dd>
                    </div>
                    {detail.customerNameEn ? (
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-gray-500">영문 이름</dt>
                        <dd>{detail.customerNameEn}</dd>
                      </div>
                    ) : null}
                    {detail.customerBirthDate ? (
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-gray-500">생년월일</dt>
                        <dd>
                          {new Date(detail.customerBirthDate).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          })}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-gray-500">휴대폰</dt>
                      <dd>{detail.customerPhone}</dd>
                    </div>
                    {detail.customerEmail ? (
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-gray-500">이메일</dt>
                        <dd>{detail.customerEmail}</dd>
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-gray-500">개인정보 동의</dt>
                      <dd>{detail.privacyAgreed ? '동의함' : '미기록'}</dd>
                    </div>
                    {detail.privacyAgreedAt ? (
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-gray-500">동의 시각</dt>
                        <dd>{new Date(detail.privacyAgreedAt).toLocaleString('ko-KR')}</dd>
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-gray-500">마케팅 수신</dt>
                      <dd>
                        {detail.marketingConsent ? '동의함' : '미동의'}
                        {detail.marketingConsentAt ? (
                          <span className="ml-1 text-gray-500">
                            ({new Date(detail.marketingConsentAt).toLocaleString('ko-KR')})
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="border-l-4 border-[#0f172a] bg-white py-2 pl-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#0f172a]">알림 발송 상태</h3>
                  <p className="mt-1 text-sm text-[#0f172a]">
                    {detail.notificationStatus === 'sent'
                      ? '발송 완료'
                      : detail.notificationStatus === 'failed'
                        ? '실패'
                        : '대기/미발송'}
                    {detail.notificationError && (
                      <span className="mt-1 block text-xs text-red-600">{detail.notificationError}</span>
                    )}
                  </p>
                </div>

                {(statusError || deleteError) && (
                  <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {statusError ?? deleteError}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4">
                  {selectedIntake?.kind === 'booking' && detail ? (
                    <button
                      type="button"
                      disabled={deleteBusy}
                      onClick={() => {
                        setDeleteError(null)
                        void deleteOne(
                          'booking',
                          detail.id,
                          detail.bookingNumber,
                          selectedIntake.isTest,
                        )
                      }}
                      className="mr-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                    >
                      {selectedIntake.isTest ? '테스트 예약 삭제' : '예약 삭제'}
                    </button>
                  ) : null}
                  <span className="text-sm text-gray-500">상태 변경:</span>
                  {getNextBookingStatuses(detail.status).map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={updating || detail.status === status}
                      onClick={() => updateStatus(detail.id, status)}
                      className={`border px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                        status === '예약확정'
                          ? 'border-emerald-600 bg-[#ecfdf5] text-emerald-800 hover:bg-emerald-100'
                          : status === '취소'
                            ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            : 'border-[#0f172a] bg-white text-[#0f172a] hover:bg-gray-50'
                      }`}
                    >
                      → {status}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">상담 접수 정보를 불러올 수 없습니다.</p>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
