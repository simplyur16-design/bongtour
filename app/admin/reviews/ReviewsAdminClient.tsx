'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import type { ReviewRow } from '@/lib/reviews-types'
import { reviewTypeLabel } from '@/lib/review-type-labels'

type Tab = ReviewRow['status'] | 'all'

function destLine(r: ReviewRow): string {
  return [r.destination_country, r.destination_city].filter(Boolean).join(' · ') || '—'
}

function ReviewTextFieldsBlock({
  r,
  inFlight,
  setInFlight,
  onAfterSave,
  setError,
}: {
  r: ReviewRow
  inFlight: boolean
  setInFlight: (v: boolean) => void
  onAfterSave: () => Promise<void>
  setError: (s: string | null) => void
}) {
  const [title, setTitle] = useState(r.title)
  const [excerpt, setExcerpt] = useState(r.excerpt)
  const [body, setBody] = useState(r.body ?? '')

  useEffect(() => {
    setTitle(r.title)
    setExcerpt(r.excerpt)
    setBody(r.body ?? '')
  }, [r.id, r.title, r.excerpt, r.body])

  async function saveText() {
    setError(null)
    setInFlight(true)
    try {
      const res = await fetch(`/api/admin/reviews/${r.id}/content`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, excerpt, body: body.trim() ? body : null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      await onAfterSave()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setInFlight(false)
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold text-bt-muted">title</p>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={inFlight}
        className="mt-1 w-full rounded border border-bt-border px-2 py-1.5 text-sm text-bt-title"
      />
      <p className="mt-3 text-xs font-semibold text-bt-muted">excerpt</p>
      <textarea
        value={excerpt}
        onChange={(e) => setExcerpt(e.target.value)}
        disabled={inFlight}
        rows={3}
        className="mt-1 w-full rounded border border-bt-border px-2 py-1.5 text-sm text-bt-body"
      />
      <p className="mt-3 text-xs font-semibold text-bt-muted">body</p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={inFlight}
        rows={8}
        className="mt-1 w-full rounded border border-bt-border px-2 py-1.5 text-sm text-bt-muted"
      />
      <button
        type="button"
        disabled={inFlight}
        onClick={() => void saveText()}
        className="mt-3 rounded-lg border border-bt-border bg-white px-3 py-1.5 text-sm font-medium text-bt-title hover:bg-bt-surface disabled:opacity-50"
      >
        제목·요약·본문 저장
      </button>
    </div>
  )
}

export default function ReviewsAdminClient() {
  const [tab, setTab] = useState<Tab>('pending')
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inFlight, setInFlight] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({ status: tab, limit: '100' })
      const res = await fetch(`/api/admin/reviews?${q}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '목록을 불러오지 못했습니다.')
      setRows(data.rows ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    void load()
  }, [load])

  async function postAction(path: string, body?: object) {
    setInFlight(true)
    setError(null)
    try {
      const res = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '처리 실패')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setInFlight(false)
    }
  }

  return (
    <div className="max-w-6xl pb-12">
      <h1 className="text-xl font-semibold text-bt-title">회원 여행 후기 검수</h1>
      <p className="mt-1 text-sm text-bt-muted">
        목록: 작성일·회원 ID·category·review_type·제목·목적지·상태·피처드. 상세에서 제목·요약·본문 저장, 승인·반려·보관, 피처드·순서·노출일.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(['pending', 'published', 'rejected', 'archived', 'all'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t ? 'bg-bt-title text-white' : 'border border-bt-border bg-white text-bt-body hover:bg-bt-surface'
            }`}
          >
            {t === 'all' ? '전체' : t}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto rounded-lg border border-bt-border bg-white px-3 py-1.5 text-sm text-bt-body hover:bg-bt-surface"
        >
          새로고침
        </button>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="mt-8 text-sm text-bt-muted">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-bt-muted">목록이 비어 있습니다.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-bt-border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-bt-border bg-bt-surface/80 text-xs font-semibold text-bt-muted">
              <tr>
                <th className="px-3 py-2">작성일</th>
                <th className="px-3 py-2">회원 ID</th>
                <th className="px-3 py-2">category</th>
                <th className="px-3 py-2">review_type</th>
                <th className="px-3 py-2">제목</th>
                <th className="px-3 py-2">목적지</th>
                <th className="px-3 py-2">status</th>
                <th className="px-3 py-2">피처드</th>
                <th className="px-3 py-2">상세</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-b border-bt-border/80 hover:bg-bt-surface/40">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-bt-subtle">{r.created_at?.slice(0, 10)}</td>
                    <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs" title={r.user_id}>
                      {r.user_id}
                    </td>
                    <td className="px-3 py-2">{r.category}</td>
                    <td className="px-3 py-2">{reviewTypeLabel(r.review_type)}</td>
                    <td className="max-w-[200px] truncate px-3 py-2 font-medium text-bt-title" title={r.title}>
                      {r.title}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-bt-muted">{destLine(r)}</td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2">{r.is_featured ? 'Y' : '—'}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-bt-link hover:underline"
                        onClick={() => setOpenId((id) => (id === r.id ? null : r.id))}
                      >
                        {openId === r.id ? '접기' : '펼치기'}
                      </button>
                    </td>
                  </tr>
                  {openId === r.id ? (
                    <tr className="border-b border-bt-border bg-bt-surface/30">
                      <td colSpan={9} className="px-4 py-4 text-sm">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <ReviewTextFieldsBlock
                            r={r}
                            inFlight={inFlight}
                            setInFlight={setInFlight}
                            setError={setError}
                            onAfterSave={load}
                          />
                          <div className="space-y-2 text-xs">
                            <p>
                              <span className="font-semibold text-bt-muted">customer_type</span> {r.customer_type ?? '—'}
                            </p>
                            <p>
                              <span className="font-semibold text-bt-muted">tags</span>{' '}
                              {r.tags?.length ? r.tags.join(', ') : '—'}
                            </p>
                            <p>
                              <span className="font-semibold text-bt-muted">travel_month</span> {r.travel_month ?? '—'}
                            </p>
                            <p>
                              <span className="font-semibold text-bt-muted">rating_label</span> {r.rating_label ?? '—'}
                            </p>
                            <p>
                              <span className="font-semibold text-bt-muted">thumbnail_url</span>{' '}
                              {r.thumbnail_url ? (
                                <a href={r.thumbnail_url} className="text-bt-link break-all" target="_blank" rel="noreferrer">
                                  링크
                                </a>
                              ) : (
                                '—'
                              )}
                            </p>
                            <p>
                              <span className="font-semibold text-bt-muted">displayed_date</span> {r.displayed_date ?? '—'}
                            </p>
                            <p>
                              <span className="font-semibold text-bt-muted">display_order</span> {r.display_order}
                            </p>
                            <p>
                              <span className="font-semibold text-bt-muted">rejection_reason</span>{' '}
                              {r.rejection_reason ?? '—'}
                            </p>
                            <p>
                              <span className="font-semibold text-bt-muted">source_type</span> {r.source_type}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-bt-border pt-4">
                          {r.status !== 'published' ? (
                            <button
                              type="button"
                              disabled={inFlight}
                              onClick={() => {
                                const raw = window.prompt('노출일 YYYY-MM-DD (비우면 자동)', new Date().toISOString().slice(0, 10))
                                if (raw === null) return
                                const displayed_date = raw.trim() || undefined
                                void postAction(`/api/admin/reviews/${r.id}/approve`, {
                                  ...(displayed_date ? { displayed_date } : {}),
                                })
                              }}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              승인(게시)
                            </button>
                          ) : null}
                          {r.status !== 'rejected' ? (
                            <button
                              type="button"
                              disabled={inFlight}
                              onClick={() => {
                                const reason = window.prompt('반려 사유')?.trim()
                                if (reason) void postAction(`/api/admin/reviews/${r.id}/reject`, { rejection_reason: reason })
                              }}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                            >
                              반려
                            </button>
                          ) : null}
                          {r.status !== 'archived' ? (
                            <button
                              type="button"
                              disabled={inFlight}
                              onClick={() => void postAction(`/api/admin/reviews/${r.id}/archive`)}
                              className="rounded-lg border border-bt-border px-3 py-1.5 text-sm text-bt-body hover:bg-bt-surface disabled:opacity-50"
                            >
                              보관
                            </button>
                          ) : null}
                          {r.status === 'published' ? (
                            <>
                              <button
                                type="button"
                                disabled={inFlight}
                                onClick={() =>
                                  void postAction(`/api/admin/reviews/${r.id}/feature`, {
                                    is_featured: !r.is_featured,
                                  })
                                }
                                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                              >
                                피처드 {r.is_featured ? '해제' : '지정'}
                              </button>
                              <label className="flex items-center gap-2 text-sm text-bt-muted">
                                순서
                                <input
                                  type="number"
                                  className="w-20 rounded border border-bt-border px-2 py-1"
                                  defaultValue={r.display_order}
                                  onBlur={(e) => {
                                    const v = Number(e.target.value)
                                    if (!Number.isFinite(v)) return
                                    void postAction(`/api/admin/reviews/${r.id}/feature`, { display_order: v })
                                  }}
                                />
                              </label>
                              <label className="flex items-center gap-2 text-sm text-bt-muted">
                                노출일
                                <input
                                  type="date"
                                  min="2025-01-07"
                                  className="rounded border border-bt-border px-2 py-1"
                                  defaultValue={r.displayed_date?.slice(0, 10) ?? ''}
                                  onBlur={(e) => {
                                    const d = e.target.value.trim()
                                    if (!d) {
                                      void postAction(`/api/admin/reviews/${r.id}/moderation`, { displayed_date: null })
                                      return
                                    }
                                    void postAction(`/api/admin/reviews/${r.id}/moderation`, { displayed_date: d })
                                  }}
                                />
                              </label>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
