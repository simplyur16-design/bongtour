'use client'

import { useState } from 'react'
import { OPTIONAL_TOUR_UI_INITIAL_ROWS, OPTIONAL_TOUR_UI_MAX_ROWS } from '@/lib/optional-tour-limits'
type OptionalTourRow = {
  id: string
  name: string
  priceUsd: number
  duration: string
  waitPlaceIfNotJoined: string
  priceText?: string
  bookingType?: string
  rawText?: string
}
type Props = { tours: OptionalTourRow[]; productType?: string | null; embedded?: boolean }

export default function OptionalToursFactSheet({ tours, productType, embedded = false }: Props) {
  /** 기본 펼침: 견적 박스 안내와 실제 표 내용이 바로 이어지도록 */
  const [open, setOpen] = useState(true)
  const [showAllRows, setShowAllRows] = useState(false)

  if (!tours.length) return null
  const visibleTours = showAllRows ? tours.slice(0, OPTIONAL_TOUR_UI_MAX_ROWS) : tours.slice(0, OPTIONAL_TOUR_UI_INITIAL_ROWS)

  const type = (productType ?? '').toLowerCase()
  const sectionDescription =
    type === 'travel' || type === 'semi'
      ? '기본 일정 외에 추가로 선택할 수 있는 관광 및 옵션입니다. 현지 운영 상황에 따라 진행 여부와 금액이 달라질 수 있습니다.'
      : type === 'airtel'
        ? '항공과 호텔 외에 추가로 선택할 수 있는 일정, 투어, 체험 또는 이동 서비스입니다. 자유시간에 맞춰 투어, 체험, 입장권, 이동 서비스를 추가로 선택해 일정을 더 알차게 구성할 수 있습니다.'
        : '기본 일정 외에 추가로 선택할 수 있는 현지 일정 및 옵션입니다. 진행 여부와 금액은 현지 상황 또는 공급사 운영 기준에 따라 달라질 수 있습니다.'

  const body = (
    <>
      <p className={`text-xs leading-relaxed text-gray-600 ${embedded ? 'text-center' : ''} ${embedded ? '' : 'mt-3'}`}>
        {sectionDescription}
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[400px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-3 py-2.5 text-left font-semibold text-gray-700">관광명</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-700">가격</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-700">진행/설명</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-700">신청 방식</th>
            </tr>
          </thead>
          <tbody>
            {visibleTours.map((row) => (
              <tr key={row.id} className="border-b border-gray-100">
                <td className="px-3 py-2.5 text-gray-800">{row.name}</td>
                <td className="px-3 py-2.5 text-gray-800">{row.priceText ?? (row.priceUsd > 0 ? `$${row.priceUsd}` : '문의')}</td>
                <td className="px-3 py-2.5 text-gray-800">{row.duration || row.rawText || row.waitPlaceIfNotJoined || '-'}</td>
                <td className="px-3 py-2.5 text-gray-600">
                  {row.bookingType === 'onsite'
                    ? '현지 신청'
                    : row.bookingType === 'pre'
                      ? '사전 신청'
                      : row.bookingType === 'inquire'
                        ? '출발 전 문의'
                        : '진행 여부 확인 필요'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tours.length > OPTIONAL_TOUR_UI_INITIAL_ROWS ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowAllRows((v) => !v)}
            className="text-xs font-semibold text-bt-link hover:underline"
          >
            {showAllRows
              ? '현지옵션 접기'
              : `현지옵션 더보기 (전체 ${Math.min(tours.length, OPTIONAL_TOUR_UI_MAX_ROWS)}개)`}
          </button>
        </div>
      ) : null}
      <p className={`mt-3 text-xs leading-relaxed text-gray-500 ${embedded ? 'text-center' : ''}`}>
        현지옵션은 기본 여행경비에 포함되지 않으며, 별도 비용이 발생할 수 있습니다. 진행 여부와 금액은 현지 상황 또는 공급사 운영 기준에 따라 달라질 수 있습니다.
      </p>
    </>
  )

  if (embedded) {
    return <div className="text-bt-body [&_table]:text-bt-body [&_td]:text-bt-body [&_th]:text-bt-title">{body}</div>
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <h2 className="text-lg font-bold text-gray-900">현지옵션</h2>
        <span className="shrink-0 text-sm font-medium text-bong-orange">
          {open ? '접기' : `보기 (${tours.length}건)`}
        </span>
      </button>
      {open && body}
    </section>
  )
}
