'use client'

import { readAdminResponseJson } from '@/lib/admin/read-admin-response-json'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type PurgePreview = {
  candidates?: { kind: string; accessionNumber: string }[]
  count?: number
}

type Props = {
  /** 문의만 / 예약 포함 통합 안내 */
  variant?: 'inquiries' | 'combined'
  onPurged?: () => void
}

export default function TestIntakeAdminTools({ variant = 'combined', onPurged }: Props) {
  const [testCount, setTestCount] = useState<number | null>(null)
  const [purgeBusy, setPurgeBusy] = useState(false)
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null)

  const refreshCount = useCallback(() => {
    fetch('/api/admin/intake/purge-test')
      .then((r) => r.json())
      .then((data: PurgePreview) => {
        setTestCount(typeof data.count === 'number' ? data.count : data.candidates?.length ?? 0)
      })
      .catch(() => setTestCount(null))
  }, [])

  useEffect(() => {
    refreshCount()
  }, [refreshCount])

  const purgeAll = async () => {
    const n = testCount ?? 0
    if (n === 0) return
    const previewRes = await fetch('/api/admin/intake/purge-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: true }),
    })
    const preview = (await readAdminResponseJson(previewRes).catch(() => ({}))) as PurgePreview & { error?: string }
    if (!previewRes.ok) {
      setPurgeMessage(preview.error ?? '목록 조회 실패')
      return
    }
    const total = preview.candidates?.length ?? preview.count ?? n
    const sample = (preview.candidates ?? [])
      .slice(0, 5)
      .map((c) => `${c.kind === 'inquiry' ? '문의' : '예약'} ${c.accessionNumber}`)
      .join(', ')
    if (
      !window.confirm(
        `테스트·E2E 접수 ${total}건을 삭제합니다.\n${sample ? `예: ${sample}${total > 5 ? ' …' : ''}\n` : ''}계속할까요?`,
      )
    ) {
      return
    }
    setPurgeBusy(true)
    setPurgeMessage(null)
    try {
      const res = await fetch('/api/admin/intake/purge-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      })
      const data = (await readAdminResponseJson(res).catch(() => ({}))) as {
        error?: string
        deletedInquiries?: number
        deletedBookings?: number
      }
      if (!res.ok) {
        setPurgeMessage(data.error ?? '삭제 실패')
        return
      }
      setPurgeMessage(
        `삭제 완료 — 문의 ${data.deletedInquiries ?? 0}건, 예약 ${data.deletedBookings ?? 0}건`,
      )
      refreshCount()
      onPurged?.()
    } finally {
      setPurgeBusy(false)
    }
  }

  if (testCount === null || testCount === 0) {
    return null
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
      <span>
        테스트·E2E 접수 <strong>{testCount}건</strong>
        {variant === 'inquiries' ? ' (문의·예약 포함)' : ' (문의 + 패키지 예약)'}
      </span>
      <button
        type="button"
        disabled={purgeBusy}
        onClick={() => void purgeAll()}
        className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 font-medium hover:bg-amber-100 disabled:opacity-50"
      >
        {purgeBusy ? '삭제 중…' : '테스트 접수 일괄 삭제'}
      </button>
      {variant === 'inquiries' ? (
        <Link href="/admin/bookings" className="text-xs font-medium text-amber-900 underline">
          상담·예약 통합 목록
        </Link>
      ) : null}
      {purgeMessage ? <span className="text-emerald-800">{purgeMessage}</span> : null}
    </div>
  )
}

export type IntakeDeleteRow = {
  kind: 'inquiry' | 'booking'
  id: string | number
  accessionNumber: string
  isTest?: boolean
}

export function intakeSelectionKey(kind: 'inquiry' | 'booking', id: string | number): string {
  return `${kind}:${id}`
}

function confirmDeleteMessage(label: string, isTest: boolean, count = 1): string {
  if (count > 1) {
    return isTest
      ? `선택한 테스트 접수 ${count}건을 삭제할까요?`
      : `선택한 접수 ${count}건을 삭제합니다. 복구할 수 없습니다.\n${label}\n계속할까요?`
  }
  return isTest
    ? `테스트 접수 「${label}」를 삭제할까요?`
    : `접수 「${label}」를 삭제합니다. 복구할 수 없습니다. 계속할까요?`
}

export function useAdminIntakeDelete(onDone: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deleteOne = async (
    kind: 'inquiry' | 'booking',
    id: string | number,
    label: string,
    isTest = false,
  ) => {
    if (!window.confirm(confirmDeleteMessage(label, isTest))) return
    setBusy(true)
    setError(null)
    try {
      const url =
        kind === 'inquiry' ? `/api/admin/inquiries/${id}` : `/api/admin/bookings/${id}`
      const res = await fetch(url, { method: 'DELETE' })
      const data = (await readAdminResponseJson(res).catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? '삭제 실패')
        return
      }
      onDone()
    } finally {
      setBusy(false)
    }
  }

  const deleteSelected = async (rows: IntakeDeleteRow[]) => {
    if (rows.length === 0) return
    const allTest = rows.every((r) => r.isTest)
    const sample = rows
      .slice(0, 5)
      .map((r) => r.accessionNumber)
      .join(', ')
    const sampleLine = sample ? `\n예: ${sample}${rows.length > 5 ? ' …' : ''}` : ''
    let confirmMsg: string
    if (rows.length === 1) {
      confirmMsg = confirmDeleteMessage(rows[0].accessionNumber, rows[0].isTest ?? false)
    } else if (allTest) {
      confirmMsg = `선택한 테스트 접수 ${rows.length}건을 삭제할까요?${sampleLine}`
    } else {
      confirmMsg = `선택한 접수 ${rows.length}건을 삭제합니다. 복구할 수 없습니다.${sampleLine}\n계속할까요?`
    }
    if (!window.confirm(confirmMsg)) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/intake/delete-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: rows.map((r) => ({ kind: r.kind, id: r.id })),
        }),
      })
      const data = (await readAdminResponseJson(res).catch(() => ({}))) as {
        error?: string
        deletedCount?: number
        failedCount?: number
        failed?: { error: string }[]
      }
      if (!res.ok) {
        setError(data.error ?? '삭제 실패')
        return
      }
      if ((data.failedCount ?? 0) > 0) {
        const first = data.failed?.[0]?.error
        setError(
          `${data.deletedCount ?? 0}건 삭제, ${data.failedCount}건 실패${first ? `: ${first}` : ''}`,
        )
        if ((data.deletedCount ?? 0) > 0) onDone()
        return
      }
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return { deleteOne, deleteSelected, busy, error, setError }
}

/** @deprecated useAdminIntakeDelete — 이름만 유지 */
export const useDeleteTestIntake = useAdminIntakeDelete
