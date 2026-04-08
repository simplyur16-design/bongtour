'use client'

import type { AdminMonthlyCurationListItem } from '@/lib/admin-curation'
import {
  briefingSourceLabel,
  curationScopeLabel,
  curationStatusLabel,
  primaryInquiryTypeLabel,
} from '@/lib/admin-curation'

type Props = {
  rows: AdminMonthlyCurationListItem[]
  loading: boolean
  onEdit: (row: AdminMonthlyCurationListItem) => void
}

function truncate(s: string, n: number) {
  const t = s.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n)}…`
}

export default function MonthlyCurationTable({ rows, loading, onEdit }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
        불러오는 중…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
        조건에 맞는 카드가 없습니다. 필터를 바꾸거나 새 카드를 만드세요.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
            <th className="px-3 py-2.5">월</th>
            <th className="px-3 py-2.5">범위</th>
            <th className="px-3 py-2.5">목적지</th>
            <th className="px-3 py-2.5">한 줄 테마</th>
            <th className="px-3 py-2.5">게시</th>
            <th className="px-3 py-2.5">활성</th>
            <th className="px-3 py-2.5">메인 후보</th>
            <th className="px-3 py-2.5">순서</th>
            <th className="px-3 py-2.5">문의</th>
            <th className="px-3 py-2.5">출처</th>
            <th className="px-3 py-2.5">상품</th>
            <th className="px-3 py-2.5 w-[72px]" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-800">{r.yearMonth}</td>
              <td className="whitespace-nowrap px-3 py-2 text-gray-800">{curationScopeLabel(r.scope)}</td>
              <td className="max-w-[140px] px-3 py-2 text-gray-900" title={r.destinationName}>
                {truncate(r.destinationName, 24)}
              </td>
              <td className="max-w-[200px] px-3 py-2 text-gray-700" title={r.oneLineTheme}>
                {truncate(r.oneLineTheme, 36)}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {curationStatusLabel(r.status)}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <span className={r.isActive ? 'text-emerald-700' : 'text-gray-400'}>{r.isActive ? 'ON' : 'OFF'}</span>
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.mainVisibility.wouldServe ? 'bg-sky-100 text-sky-900' : 'bg-gray-100 text-gray-600'
                  }`}
                  title={r.mainVisibility.summary}
                >
                  {r.mainVisibility.wouldServe ? '조건 충족' : '미노출'}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.sortOrder}</td>
              <td className="max-w-[120px] px-3 py-2 text-xs text-gray-700" title={r.primaryInquiryType}>
                {primaryInquiryTypeLabel(r.primaryInquiryType)}
              </td>
              <td className="max-w-[120px] px-3 py-2 text-xs text-gray-700" title={r.briefingSourceType}>
                {briefingSourceLabel(r.briefingSourceType)}
              </td>
              <td className="max-w-[100px] px-3 py-2 font-mono text-[11px] text-gray-600" title={r.linkedProductId ?? ''}>
                {r.linkedProductId ? truncate(r.linkedProductId, 10) : '—'}
              </td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => onEdit(r)}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50"
                >
                  수정
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
