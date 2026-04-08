'use client'

import { useMemo, useState } from 'react'
import type { UiOptionalTourRow } from '@/lib/optional-tours-ui-model'
import {
  formatOptionalTourAlternateScheduleCell,
  formatOptionalTourFeeCellForPublicTable,
  formatOptionalTourGuideOnlyCell,
} from '@/lib/optional-tours-ui-model'
import { OPTIONAL_TOUR_UI_INITIAL_ROWS, OPTIONAL_TOUR_UI_MAX_ROWS } from '@/lib/optional-tour-limits'

type Props = {
  noticeRaw: string | null
  noticeItems: string[]
  displayNoticeFinal?: string | null
  rows: UiOptionalTourRow[]
  productType?: string | null
  /** 부가정보 탭 내부: 접기 헤더·외곽 카드 없이 본문만 */
  embedded?: boolean
}

function bookingLabel(t: UiOptionalTourRow['bookingType']): string {
  if (t === 'onsite') return '현지 신청'
  if (t === 'pre') return '사전 신청'
  if (t === 'inquire') return '출발 전 문의'
  return '진행 여부 확인 필요'
}

export default function StructuredLocalOptionsSection({
  noticeRaw,
  noticeItems,
  displayNoticeFinal,
  rows,
  productType,
  embedded = false,
}: Props) {
  const [open, setOpen] = useState(true)
  const [showAllRows, setShowAllRows] = useState(false)
  const hasNotice = Boolean(noticeRaw?.trim()) || noticeItems.length > 0
  const hasRows = rows.length > 0
  if (!hasNotice && !hasRows) return null
  const visibleRows = showAllRows ? rows.slice(0, OPTIONAL_TOUR_UI_MAX_ROWS) : rows.slice(0, OPTIONAL_TOUR_UI_INITIAL_ROWS)

  const showNoteCol = useMemo(() => rows.some((r) => Boolean(r.descriptionBody?.trim())), [rows])
  const showBookingCol = useMemo(() => rows.some((r) => r.bookingType !== 'unknown'), [rows])
  const type = (productType ?? '').toLowerCase()
  const sectionDescription =
    type === 'travel' || type === 'semi'
      ? '기본 일정 외에 추가로 선택할 수 있는 관광 및 옵션입니다. 현지 운영 상황에 따라 진행 여부와 금액이 달라질 수 있습니다.'
      : type === 'airtel'
        ? '항공과 호텔 외에 추가로 선택할 수 있는 일정·투어·체험 등입니다.'
        : '기본 일정 외 추가 선택 옵션입니다. 진행 여부와 금액은 현지 또는 공급사 기준에 따릅니다.'

  const publicTable =
    hasRows ? (
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-2 py-2 font-semibold text-gray-700">옵션명</th>
              <th className="px-2 py-2 font-semibold text-gray-700">이용요금</th>
              <th className="px-2 py-2 font-semibold text-gray-700">소요시간</th>
              <th className="px-2 py-2 font-semibold text-gray-700">최소행사인원</th>
              <th className="px-2 py-2 font-semibold text-gray-700">대체일정</th>
              <th className="px-2 py-2 font-semibold text-gray-700">미선택 시 가이드 동행</th>
              {showNoteCol ? <th className="px-2 py-2 font-semibold text-gray-700">비고</th> : null}
              {showBookingCol ? <th className="px-2 py-2 font-semibold text-gray-700">신청</th> : null}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 align-top">
                <td className="px-2 py-2 text-gray-900">
                  {row.supplierTags && row.supplierTags.length > 0 ? (
                    <div className="mb-1 flex flex-wrap gap-1">
                      {row.supplierTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-block rounded-full bg-bt-brand-blue-strong/10 px-2 py-0.5 text-[10px] font-semibold text-bt-brand-blue-strong"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <span className="font-medium">{row.name}</span>
                </td>
                <td className="px-2 py-2 whitespace-normal text-gray-800">
                  {formatOptionalTourFeeCellForPublicTable(row)}
                </td>
                <td className="px-2 py-2 text-gray-800">{row.durationText?.trim() || '—'}</td>
                <td className="px-2 py-2 text-gray-800">{row.minPaxText?.trim() || '—'}</td>
                <td className="px-2 py-2 text-gray-800">{formatOptionalTourAlternateScheduleCell(row)}</td>
                <td className="px-2 py-2 text-gray-800">{formatOptionalTourGuideOnlyCell(row)}</td>
                {showNoteCol ? (
                  <td className="px-2 py-2 text-xs leading-relaxed text-gray-700">
                    {row.descriptionBody?.trim() ? (
                      <span className="block whitespace-pre-wrap">{row.descriptionBody.trim()}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                ) : null}
                {showBookingCol ? (
                  <td className="px-2 py-2 text-gray-600">{bookingLabel(row.bookingType)}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > OPTIONAL_TOUR_UI_INITIAL_ROWS ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowAllRows((v) => !v)}
              className="text-xs font-semibold text-bt-link hover:underline"
            >
              {showAllRows
                ? '현지옵션 접기'
                : `현지옵션 더보기 (전체 ${Math.min(rows.length, OPTIONAL_TOUR_UI_MAX_ROWS)}개)`}
            </button>
          </div>
        ) : null}
      </div>
    ) : null

  const body = (
    <>
      <p
        className={`text-xs leading-relaxed text-gray-600 ${embedded ? 'text-center' : ''} ${embedded ? '' : 'mt-3'}`}
      >
        {sectionDescription}
      </p>

      {publicTable}

      {hasNotice && !hasRows && (
        <div className="mt-4 rounded-lg border border-bt-card-accent-border bg-bt-card-accent-soft p-3">
          <p className="text-center text-xs font-semibold text-bt-card-accent-strong">현지옵션 안내</p>
          {noticeItems.length > 0 ? (
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-slate-800">
              {noticeItems.map((line, i) => (
                <li key={i} className="pl-1">
                  {line}
                </li>
              ))}
            </ol>
          ) : noticeRaw ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{noticeRaw}</p>
          ) : null}
        </div>
      )}

      <p className={`mt-3 text-xs leading-relaxed text-gray-500 ${embedded ? 'text-center' : ''}`}>
        {displayNoticeFinal?.trim()
          ? displayNoticeFinal.trim()
          : '현지옵션은 현지에서 신청 후 진행되며, 비용과 진행 여부는 현지 기준에 따라 달라질 수 있습니다.'}
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
        <span className="shrink-0 text-sm font-medium text-bong-orange">{open ? '접기' : '보기'}</span>
      </button>
      {open && body}
    </section>
  )
}
