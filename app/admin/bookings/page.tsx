'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { formatKRW } from '@/lib/price-utils'
import AdminEmptyState from '../components/AdminEmptyState'
import AdminKpiCard from '../components/AdminKpiCard'
import AdminPageHeader from '../components/AdminPageHeader'
import AdminStatusBadge from '../components/AdminStatusBadge'
import { getNextBookingStatuses } from '@/lib/booking-status-policy'

type Booking = {
  id: number
  productId: string
  productTitle: string
  selectedDate: string
  preferredDepartureDate?: string | null
  pricingMode?: string | null
  adultCount: number
  childBedCount: number
  childNoBedCount: number
  infantCount: number
  totalKrwAmount: number
  totalLocalAmount: number
  localCurrency: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
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
  const [list, setList] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<Booking | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const fetchList = useCallback(() => {
    fetch('/api/admin/bookings')
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setList(data) : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  useEffect(() => {
    setStatusError(null)
    if (selectedId == null) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    fetch(`/api/admin/bookings/${selectedId}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }, [selectedId])

  const updateStatus = async (id: number, status: string) => {
    setUpdating(true)
    setStatusError(null)
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setStatusError(data.error ?? '상태 변경 실패')
        return
      }
      setDetail((d) => (d && d.id === id ? { ...d, status } : d))
      setList((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)))
    } finally {
      setUpdating(false)
    }
  }

  const consultingCount = list.filter((b) => b.status === '상담중').length
  const inProgressCount = list.filter((b) => b.status === '예약진행중').length
  const confirmedCount = list.filter((b) => b.status === '예약확정').length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-4">
          <Link href="/admin" className="text-sm text-gray-500 hover:text-[#0f172a]">← 대시보드</Link>
        </div>
        <AdminPageHeader
          title="상담·예약"
          subtitle="고객 상담 접수와 일정·인원 문의를 관리합니다. 확정 시 카카오 등으로 연락해 주세요."
        />

        {/* KPI */}
        {!loading && (
          <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AdminKpiCard label="접수" value={`${list.length}건`} tone="muted" />
            <AdminKpiCard label="상담중" value={`${consultingCount}건`} tone="muted" />
            <AdminKpiCard label="예약진행" value={`${inProgressCount}건`} tone="muted" />
            <AdminKpiCard label="확정" value={`${confirmedCount}건`} tone="muted" />
          </section>
        )}

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 border-l-4 border-[#0f172a] pl-3 text-base font-semibold text-[#0f172a]">
            상담 접수 목록 (최신순)
          </h2>
          {loading ? (
            <div className="flex justify-center py-12 text-gray-500">로딩 중…</div>
          ) : list.length === 0 ? (
            <AdminEmptyState
              title="상담 접수가 없습니다"
              description="고객이 상품 상세에서 문의하면 여기에 접수됩니다."
              actionLabel="대시보드"
              actionHref="/admin"
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {list.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(b.id)}
                    className="flex w-full items-center justify-between py-3 text-left hover:bg-gray-50"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                        #{b.id}
                      </span>
                      <span className="font-medium text-[#0f172a]">{b.productTitle}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(b.selectedDate).toLocaleDateString('ko-KR')} 출발
                      </span>
                      <AdminStatusBadge
                        variant={STATUS_TO_VARIANT[b.status] ?? 'received'}
                        label={b.status}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 상담·예약 상세 (선택 시) */}
        {selectedId != null && (
          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 border-l-4 border-[#0f172a] pl-3 text-base font-semibold text-[#0f172a]">상담·예약 상세</h2>
            {detailLoading ? (
              <div className="flex justify-center py-8">
                <p className="text-sm font-medium text-gray-500">로딩 중...</p>
              </div>
            ) : detail ? (
              <div className="space-y-6">
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
                    {detail.preferredDepartureDate && (
                      <p className="mt-2 text-xs text-gray-500">
                        희망일 병기:{' '}
                        {new Date(detail.preferredDepartureDate).toLocaleDateString('ko-KR')}
                      </p>
                    )}
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
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">참고 금액 (원화 + 현지 외화)</h3>
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
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">연락처 정보</h3>
                  <p className="text-sm text-gray-700">{detail.customerName}</p>
                  <p className="mt-1 text-sm text-gray-600">{detail.customerPhone}</p>
                  {detail.customerEmail && (
                    <p className="mt-1 text-sm text-gray-600">{detail.customerEmail}</p>
                  )}
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

                {statusError && (
                  <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{statusError}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4">
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
