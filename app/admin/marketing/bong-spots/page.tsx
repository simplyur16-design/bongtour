'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

type BongSpotRow = {
  id: string
  title: string
  country: string | null
  city: string | null
  status: string
  updatedAt: string
}

const STATUS_OPTIONS = ['', 'draft', 'approved', 'published'] as const

export default function AdminBongSpotsListPage() {
  const [countryDraft, setCountryDraft] = useState('')
  const [cityDraft, setCityDraft] = useState('')
  const [statusDraft, setStatusDraft] = useState<string>('')
  const [applied, setApplied] = useState({ country: '', city: '', status: '' })
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [items, setItems] = useState<BongSpotRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = new URLSearchParams()
      if (applied.country.trim()) q.set('country', applied.country.trim())
      if (applied.city.trim()) q.set('city', applied.city.trim())
      if (applied.status) q.set('status', applied.status)
      q.set('page', String(page))
      q.set('limit', String(limit))
      const res = await fetch(`/api/admin/marketing/bong-spots?${q.toString()}`)
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
  }, [applied, page, limit])

  useEffect(() => {
    void load()
  }, [load])

  const applySearch = () => {
    setApplied({
      country: countryDraft,
      city: cityDraft,
      status: statusDraft,
    })
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-bt-title">봉 스팟</h1>
          <p className="mt-1 text-sm text-bt-body/70">가볼 곳 카드 — 목록·검색·편집</p>
        </div>
        <Link
          href="/admin/marketing/bong-spots/new"
          className="rounded-lg bg-bt-brand-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + 새 봉 스팟
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1 text-xs text-bt-body/80">
          국가
          <input
            value={countryDraft}
            onChange={(e) => setCountryDraft(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="예: 일본"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-bt-body/80">
          도시
          <input
            value={cityDraft}
            onChange={(e) => setCityDraft(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="예: 후쿠오카"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-bt-body/80">
          상태
          <select
            value={statusDraft}
            onChange={(e) => setStatusDraft(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s || 'all'} value={s}>
                {!s ? '전체' : s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => applySearch()}
          className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-700"
        >
          검색
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-bt-border-strong bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-4 py-3">제목</th>
              <th className="px-4 py-3">국가</th>
              <th className="px-4 py-3">도시</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">수정일</th>
              <th className="px-4 py-3">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-bt-body/60">
                  불러오는 중…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-bt-body/60">
                  데이터가 없습니다.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="px-4 py-2 font-medium text-bt-title">{row.title}</td>
                  <td className="px-4 py-2 text-bt-body">{row.country ?? '—'}</td>
                  <td className="px-4 py-2 text-bt-body">{row.city ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{row.status}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-bt-body/80">
                    {new Date(row.updatedAt).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/admin/marketing/bong-spots/${row.id}`} className="text-bt-brand-blue hover:underline">
                      편집
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-bt-body/70">
          총 {total}건 · {page}/{totalPages}페이지
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
          >
            이전
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  )
}
