'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type MonthlyRow = {
  id: string
  monthKey: string
  pageScope: string
  title: string
  subtitle: string | null
  bodyKr: string
  ctaLabel: string | null
  linkedProductId: string | null
  linkedHref: string | null
  imageUrl: string | null
  isPublished: boolean
  sortOrder: number
  updatedAt: string
}

function defaultNextMonthKey(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function isMonthKey(v: string): boolean {
  return /^\d{4}-\d{2}$/.test(v)
}

export default function MonthlyCurationGenerateClient() {
  const [targetMonth, setTargetMonth] = useState(defaultNextMonthKey)
  const [overwrite, setOverwrite] = useState(false)
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [rows, setRows] = useState<MonthlyRow[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const monthFilter = useMemo(() => targetMonth.trim(), [targetMonth])

  const loadList = useCallback(async () => {
    setListLoading(true)
    setError(null)
    try {
      if (!isMonthKey(monthFilter)) {
        setRows([])
        return
      }
      const res = await fetch(
        `/api/admin/monthly-curation-contents?scope=overseas&monthKey=${encodeURIComponent(monthFilter)}`,
        { cache: 'no-store' }
      )
      const j = (await res.json()) as { items?: MonthlyRow[]; error?: string }
      if (!res.ok) throw new Error(j.error ?? '목록을 불러오지 못했습니다.')
      setRows(Array.isArray(j.items) ? j.items : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록 로드 실패')
      setRows([])
    } finally {
      setListLoading(false)
    }
  }, [monthFilter])

  useEffect(() => {
    void loadList()
  }, [loadList])

  async function runGenerate() {
    setMessage(null)
    setError(null)
    if (!isMonthKey(targetMonth.trim())) {
      setError('대상 월은 YYYY-MM 형식이어야 합니다.')
      return
    }
    if (!overwrite && rows.length > 0) {
      const ok = window.confirm(
        `${targetMonth}에 이미 ${rows.length}건이 있습니다. 계속하면 요청이 거절됩니다. 덮어쓰려면「기존 월 데이터 덮어쓰기」를 체크하세요.`
      )
      if (!ok) return
    }
    if (overwrite && rows.length > 0) {
      const ok = window.confirm(
        `${targetMonth} 해외 시즌 큐레이션 ${rows.length}건을 삭제한 뒤 Gemini로 다시 생성합니다. 계속할까요?`
      )
      if (!ok) return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/generate-curation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetMonth: targetMonth.trim(), overwrite }),
      })
      const j = (await res.json()) as {
        ok?: boolean
        error?: string
        code?: string
        created?: number
        items?: { id: string; title: string }[]
      }
      if (!res.ok) {
        setError(j.error ?? '생성에 실패했습니다.')
        return
      }
      setMessage(`생성 완료: ${j.created ?? 0}건 (미발행 상태)`)
      setOverwrite(false)
      await loadList()
    } catch (e) {
      setError(e instanceof Error ? e.message : '요청 실패')
    } finally {
      setLoading(false)
    }
  }

  async function togglePublished(row: MonthlyRow) {
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/monthly-curation-contents/${row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...row, isPublished: !row.isPublished }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(j.error ?? '발행 상태 변경에 실패했습니다.')
        return
      }
      setMessage('발행 상태가 저장되었습니다.')
      await loadList()
    } catch (e) {
      setError(e instanceof Error ? e.message : '요청 실패')
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold text-bt-title">월별 시즌 큐레이션 (Gemini)</h1>
        <p className="mt-1 text-sm text-bt-body">
          다음 달·지정 월 출발 상품을 바탕으로 초안 카드를 생성합니다. 생성 직후에는{' '}
          <strong className="font-medium">미발행</strong>이며, 검토 후 발행을 켜 주세요.
        </p>
        <p className="mt-2 text-sm text-bt-body">
          수동 편집·이미지 업로드는{' '}
          <Link href="/admin/overseas-content" className="text-bt-brand-blue underline">
            해외 콘텐츠 CMS
          </Link>
          에서 할 수 있습니다.
        </p>
      </div>

      <section className="rounded-xl border border-bt-border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-bt-title">자동 생성</h2>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-bt-muted">대상 월 (YYYY-MM)</span>
            <input
              className="rounded border border-bt-border px-3 py-2 text-bt-title"
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              placeholder="2026-06"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-bt-body">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />
            기존 월 데이터 덮어쓰기
          </label>
          <button
            type="button"
            disabled={loading || !isMonthKey(targetMonth.trim())}
            onClick={() => void runGenerate()}
            className="rounded-lg bg-bt-brand-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? '생성 중…' : '다음 달 큐레이션 자동 생성 (Gemini)'}
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      <section className="rounded-xl border border-bt-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-bt-title">
            {isMonthKey(monthFilter) ? `${monthFilter} 목록` : '월 형식을 입력하면 목록이 표시됩니다'}
          </h2>
          <button
            type="button"
            onClick={() => void loadList()}
            className="text-sm text-bt-brand-blue underline"
            disabled={listLoading}
          >
            새로고침
          </button>
        </div>
        {listLoading ? (
          <p className="mt-4 text-sm text-bt-muted">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-bt-muted">해당 월에 저장된 큐레이션이 없습니다.</p>
        ) : (
          <ul className="mt-4 divide-y divide-bt-border">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-bt-title">{row.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-bt-body">{row.bodyKr}</p>
                  {row.linkedProductId && (
                    <Link
                      href={`/admin/products/${row.linkedProductId}`}
                      className="mt-1 inline-block text-xs text-bt-brand-blue underline"
                    >
                      상품 {row.linkedProductId}
                    </Link>
                  )}
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm text-bt-body">
                  <input
                    type="checkbox"
                    checked={row.isPublished}
                    onChange={() => void togglePublished(row)}
                  />
                  발행
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
