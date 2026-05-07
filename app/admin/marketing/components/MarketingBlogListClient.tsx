'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

type Row = {
  id: string
  title: string
  status: string
  monthKey: string | null
  citySlug: string | null
  linkedProductId: string | null
  createdAt: string
  contentTrack: string
}

const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'draft', label: '드래프트' },
  { value: 'approved', label: '검수 완료' },
  { value: 'scheduled', label: '게시 예약' },
  { value: 'published', label: '게시 완료' },
  { value: 'rejected', label: '거절' },
]

export default function MarketingBlogListClient(props: {
  contentTrack: 'package' | 'airtel'
  title: string
  subtitle: string
}) {
  const { contentTrack, title, subtitle } = props
  const basePath = contentTrack === 'package' ? '/admin/marketing/packages' : '/admin/marketing/airtel'

  const [tabStatus, setTabStatus] = useState('draft')
  const [cityDraft, setCityDraft] = useState('')
  const [monthDraft, setMonthDraft] = useState('')
  const [appliedCity, setAppliedCity] = useState('')
  const [appliedMonth, setAppliedMonth] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [items, setItems] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = new URLSearchParams()
      q.set('contentTrack', contentTrack)
      q.set('status', tabStatus)
      if (appliedMonth.trim()) q.set('monthKey', appliedMonth.trim())
      if (appliedCity.trim()) q.set('citySlug', appliedCity.trim())
      q.set('page', String(page))
      q.set('limit', String(limit))
      const res = await fetch(`/api/admin/marketing/blog-posts?${q}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '목록 조회 실패')
      setItems(data.items ?? [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록 조회 실패')
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [contentTrack, tabStatus, appliedCity, appliedMonth, page, limit])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [tabStatus, appliedCity, appliedMonth])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-bt-title">{title}</h1>
          <p className="mt-1 text-sm text-bt-body/70">{subtitle}</p>
        </div>
        <Link href="/admin/marketing" className="text-sm text-bt-brand-blue hover:underline">
          ← 마케팅 개요
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-bt-border-strong pb-3">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTabStatus(t.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              tabStatus === t.value
                ? 'bg-bt-brand-blue text-white'
                : 'bg-white text-bt-body ring-1 ring-bt-border-strong hover:bg-bt-surface-soft'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1 text-xs text-bt-body/80">
          출발 월 (YYYY-MM)
          <input
            value={monthDraft}
            onChange={(e) => setMonthDraft(e.target.value)}
            placeholder="2026-06"
            className="rounded border border-bt-border-strong px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-bt-body/80">
          도시 슬러그
          <input
            value={cityDraft}
            onChange={(e) => setCityDraft(e.target.value)}
            placeholder="부분 일치"
            className="rounded border border-bt-border-strong px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          className="rounded-lg bg-bt-title px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          onClick={() => {
            setAppliedMonth(monthDraft.trim())
            setAppliedCity(cityDraft.trim())
          }}
        >
          필터 적용
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="overflow-x-auto rounded-lg border border-bt-border-strong bg-white shadow-sm">
        <table className="min-w-full divide-y divide-bt-border-strong text-sm">
          <thead className="bg-bt-surface-soft">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-bt-title">제목</th>
              <th className="px-4 py-3 text-left font-medium text-bt-title">도시</th>
              <th className="px-4 py-3 text-left font-medium text-bt-title">출발월</th>
              <th className="px-4 py-3 text-left font-medium text-bt-title">상태</th>
              <th className="px-4 py-3 text-left font-medium text-bt-title">생성</th>
              <th className="px-4 py-3 text-left font-medium text-bt-title">상품</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bt-border-strong">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-bt-body/60">
                  불러오는 중…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-bt-body/60">
                  게시물이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="hover:bg-bt-surface-soft/80">
                  <td className="max-w-xs px-4 py-3">
                    <Link href={`${basePath}/${row.id}`} className="font-medium text-bt-brand-blue hover:underline">
                      {row.title}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-bt-body">{row.citySlug ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-bt-body">{row.monthKey ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-bt-body">{row.status}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-bt-body/80">
                    {new Date(row.createdAt).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3">
                    {row.linkedProductId ? (
                      <Link
                        href={`/admin/products/${row.linkedProductId}/edit`}
                        className="text-bt-brand-blue hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        열기
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-bt-body/80">
        <span>
          총 {total}건 · {page}/{totalPages}페이지
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            className="rounded border border-bt-border-strong px-3 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            이전
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            className="rounded border border-bt-border-strong px-3 py-1 disabled:opacity-40"
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </button>
        </div>
      </div>
    </div>
  )
}
