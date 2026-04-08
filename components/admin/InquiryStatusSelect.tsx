'use client'

import { useState } from 'react'
import { INQUIRY_ADMIN_STATUSES, inquiryStatusLabel, isInquiryAdminStatus } from '@/lib/admin-inquiry'

type Props = {
  inquiryId: string
  value: string
  disabled?: boolean
  onStatusUpdated: (id: string, nextStatus: string) => void
  onError?: (message: string) => void
}

/**
 * 행별 문의 상태 PATCH. 성공 시 부모 목록 갱신 콜백.
 */
export default function InquiryStatusSelect({
  inquiryId,
  value,
  disabled = false,
  onStatusUpdated,
  onError,
}: Props) {
  const [pending, setPending] = useState(false)

  const statusOptions = Array.from(
    new Set([value, ...INQUIRY_ADMIN_STATUSES].filter((s) => typeof s === 'string' && s.length > 0))
  )

  return (
    <select
      aria-label="문의 상태 변경"
      className="max-w-[9.5rem] rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
      value={value}
      disabled={disabled || pending}
      onChange={async (e) => {
        const next = e.target.value
        if (next === value) return
        setPending(true)
        try {
          const res = await fetch(`/api/admin/inquiries/${inquiryId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: next }),
          })
          const data = (await res.json().catch(() => ({}))) as { error?: string; allowed?: string[] }
          if (!res.ok) {
            onError?.(data.error ?? '상태 변경에 실패했습니다.')
            e.target.value = value
            return
          }
          onStatusUpdated(inquiryId, next)
        } catch {
          onError?.('네트워크 오류가 발생했습니다.')
          e.target.value = value
        } finally {
          setPending(false)
        }
      }}
    >
      {statusOptions.map((s) => (
        <option key={s} value={s}>
          {isInquiryAdminStatus(s) ? inquiryStatusLabel(s) : `${s} (비표준)`}
        </option>
      ))}
    </select>
  )
}
