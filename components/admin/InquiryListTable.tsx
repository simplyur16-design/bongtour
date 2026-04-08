'use client'

import type { AdminInquiryListItem } from '@/lib/admin-inquiry'
import InquiryStatusSelect from '@/components/admin/InquiryStatusSelect'
import {
  inquiryTypeDisplayLabel,
  leadTimeRiskBadgeClass,
  leadTimeRiskLabel,
  inquiryStatusBadgeClass,
  inquiryStatusLabel,
  preferredContactChannelBadgeClass,
  preferredContactChannelLabel,
} from '@/lib/admin-inquiry'

function dash(v: string | null | undefined): string {
  if (v == null || v === '') return '—'
  return v
}

function clip(s: string, max: number): { text: string; full: string } {
  const full = s.trim()
  if (full.length <= max) return { text: full, full }
  return { text: `${full.slice(0, max)}…`, full }
}

function formatCreatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

type Props = {
  rows: AdminInquiryListItem[]
  onStatusUpdated: (id: string, status: string) => void
  patchError: string | null
  onPatchError: (msg: string | null) => void
  selectDisabled?: boolean
}

export default function InquiryListTable({
  rows,
  onStatusUpdated,
  patchError,
  onPatchError,
  selectDisabled = false,
}: Props) {
  return (
    <div className="space-y-3">
      {patchError && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {patchError}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
              <th className="whitespace-nowrap px-3 py-2.5">접수일시</th>
              <th className="whitespace-nowrap px-3 py-2.5">유형</th>
              <th className="min-w-[120px] px-3 py-2.5">기관/단체명</th>
              <th className="min-w-[140px] px-3 py-2.5">희망 여행지</th>
              <th className="whitespace-nowrap px-3 py-2.5">출발 희망</th>
              <th className="whitespace-nowrap px-3 py-2.5">인원</th>
              <th className="min-w-[180px] px-3 py-2.5">연수 목적</th>
              <th className="whitespace-nowrap px-3 py-2.5">서비스 유형</th>
              <th className="whitespace-nowrap px-3 py-2.5">답변 채널</th>
              <th className="whitespace-nowrap px-3 py-2.5">개인정보 안내 확인</th>
              <th className="whitespace-nowrap px-3 py-2.5">이메일 발송</th>
              <th className="whitespace-nowrap px-3 py-2.5">상태</th>
              <th className="whitespace-nowrap px-3 py-2.5">리드타임</th>
              <th className="whitespace-nowrap px-3 py-2.5">신청자</th>
              <th className="whitespace-nowrap px-3 py-2.5">연락처</th>
              <th className="whitespace-nowrap px-3 py-2.5">이메일</th>
              <th className="min-w-[120px] px-3 py-2.5">상품 스냅샷</th>
              <th className="min-w-[100px] px-3 py-2.5">카드 스냅샷</th>
              <th className="min-w-[140px] px-3 py-2.5">유입 경로</th>
              <th className="whitespace-nowrap px-3 py-2.5">productId</th>
              <th className="whitespace-nowrap px-3 py-2.5">curationId</th>
              <th className="whitespace-nowrap px-3 py-2.5">상태 변경</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => {
              const titleC = r.snapshotProductTitle ? clip(r.snapshotProductTitle, 40) : null
              const cardC = r.snapshotCardLabel ? clip(r.snapshotCardLabel, 28) : null
              const pathC = r.sourcePagePath ? clip(r.sourcePagePath, 48) : null
              const pidC = r.productId ? clip(r.productId, 16) : null
              const curC = r.monthlyCurationItemId ? clip(r.monthlyCurationItemId, 16) : null
              return (
                <tr key={r.id} className="align-top hover:bg-gray-50/80">
                  <td className="whitespace-nowrap px-3 py-2 text-gray-700">{formatCreatedAt(r.createdAt)}</td>
                  <td className="px-3 py-2 text-gray-800">{inquiryTypeDisplayLabel(r.inquiryType, r.quoteKind)}</td>
                  <td className="max-w-[140px] px-3 py-2 text-xs text-gray-700" title={r.organizationName ?? ''}>
                    {dash(r.organizationName)}
                  </td>
                  <td className="max-w-[160px] px-3 py-2 text-xs text-gray-700" title={r.destinationSummary ?? ''}>
                    {dash(r.destinationSummary)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-700">{dash(r.departureDateOrMonth)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-700">
                    {r.headcount != null ? `${r.headcount}명` : '—'}
                  </td>
                  <td className="max-w-[210px] px-3 py-2 text-xs text-gray-700" title={r.trainingPurpose ?? ''}>
                    {dash(r.trainingPurpose)}
                  </td>
                  <td className="max-w-[140px] px-3 py-2 text-xs text-gray-700" title={r.selectedServiceType ?? ''}>
                    {dash(r.selectedServiceType)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-700">
                    <span
                      className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${preferredContactChannelBadgeClass(r.preferredContactChannel)}`}
                    >
                      {preferredContactChannelLabel(r.preferredContactChannel)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-700">
                    {r.privacyNoticeConfirmed ? '확인' : '미확인'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-700">
                    {r.emailSentStatus === 'sent' ? '발송완료' : r.emailSentStatus === 'failed' ? '발송실패' : '미처리'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${inquiryStatusBadgeClass(r.status)}`}
                    >
                      {inquiryStatusLabel(r.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${leadTimeRiskBadgeClass(r.leadTimeRisk)}`}
                    >
                      {leadTimeRiskLabel(r.leadTimeRisk)}
                    </span>
                  </td>
                  <td className="max-w-[100px] truncate px-3 py-2 text-gray-800" title={r.applicantName}>
                    {dash(r.applicantName)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-700">{dash(r.applicantPhone)}</td>
                  <td className="max-w-[140px] truncate px-3 py-2 text-xs text-gray-600" title={r.applicantEmail ?? ''}>
                    {dash(r.applicantEmail)}
                  </td>
                  <td className="max-w-[160px] px-3 py-2 text-xs text-gray-600" title={titleC?.full}>
                    {titleC ? titleC.text : '—'}
                  </td>
                  <td className="max-w-[120px] px-3 py-2 text-xs text-gray-600" title={cardC?.full}>
                    {cardC ? cardC.text : '—'}
                  </td>
                  <td className="max-w-[180px] px-3 py-2 text-xs text-gray-500" title={pathC?.full}>
                    {pathC ? pathC.text : '—'}
                  </td>
                  <td className="max-w-[100px] px-3 py-2 font-mono text-[11px] text-gray-600" title={pidC?.full}>
                    {pidC ? pidC.text : '—'}
                  </td>
                  <td className="max-w-[100px] px-3 py-2 font-mono text-[11px] text-gray-600" title={curC?.full}>
                    {curC ? curC.text : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <InquiryStatusSelect
                      inquiryId={r.id}
                      value={r.status}
                      disabled={selectDisabled}
                      onStatusUpdated={(id, st) => {
                        onPatchError(null)
                        onStatusUpdated(id, st)
                      }}
                      onError={onPatchError}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
