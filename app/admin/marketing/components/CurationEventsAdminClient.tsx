'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type LinkedSeasonCard = {
  id: string
  title: string
  monthKey: string
}

type CurationEventRow = {
  id: string
  name: string
  countryCode: string
  city: string | null
  monthKey: string
  startMonth: number
  endMonth: number
  type: string
  status: string
  description: string | null
  appealReason: string | null
  collectedAt: string
  year: number
  monthlyCurationContentId: string | null
  linkedSeasonCard: LinkedSeasonCard | null
}

type EditForm = {
  name: string
  city: string
  description: string
  appealReason: string
  type: string
  startMonth: number
  endMonth: number
}

const STATUS_TABS = [
  { value: '', label: '전체' },
  { value: 'draft', label: '검토 대기' },
  { value: 'approved', label: '승인됨' },
  { value: 'rejected', label: '거절' },
] as const

const TYPE_OPTIONS = ['festival', 'holiday', 'season', 'sale', 'special']

const LINKED_FILTER_OPTIONS = [
  { value: '', label: '연결 전체' },
  { value: 'linked', label: '연결됨' },
  { value: 'unlinked', label: '연결 안 됨' },
] as const

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function statusBadgeClass(status: string) {
  if (status === 'approved') return 'bg-green-100 text-green-800'
  if (status === 'rejected') return 'bg-red-100 text-red-800'
  return 'bg-amber-100 text-amber-900'
}

function statusLabel(status: string) {
  if (status === 'approved') return '승인'
  if (status === 'rejected') return '거절'
  return '검토 대기'
}

export default function CurationEventsAdminClient() {
  const searchParams = useSearchParams()
  const initialStatus = searchParams?.get('status')?.trim() ?? ''
  const [statusFilter, setStatusFilter] = useState(
    initialStatus === 'draft' || initialStatus === 'approved' || initialStatus === 'rejected'
      ? initialStatus
      : '',
  )
  const [countryFilter, setCountryFilter] = useState('')
  const [monthKeyFilter, setMonthKeyFilter] = useState('')
  const [linkedFilter, setLinkedFilter] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [events, setEvents] = useState<CurationEventRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [actionId, setActionId] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [editRow, setEditRow] = useState<CurationEventRow | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  const countryOptions = useMemo(() => {
    const set = new Set(events.map((e) => e.countryCode))
    return [...set].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [events])

  const monthKeyOptions = useMemo(() => {
    const set = new Set(events.map((e) => e.monthKey))
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [events])

  const draftIdsOnPage = useMemo(
    () => events.filter((e) => e.status === 'draft').map((e) => e.id),
    [events],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = new URLSearchParams()
      if (statusFilter) q.set('status', statusFilter)
      if (countryFilter) q.set('country', countryFilter)
      if (monthKeyFilter) q.set('monthKey', monthKeyFilter)
      if (linkedFilter) q.set('linked', linkedFilter)
      if (appliedSearch) q.set('search', appliedSearch)
      q.set('limit', '100')
      const res = await fetch(`/api/admin/marketing/curation-events/list?${q}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '목록 조회 실패')
      setEvents(data.events ?? [])
      setTotal(data.total ?? 0)
      setSelectedIds(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록 조회 실패')
      setEvents([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, countryFilter, monthKeyFilter, linkedFilter, appliedSearch])

  useEffect(() => {
    void load()
  }, [load])

  async function handleApprove(id: string) {
    setActionId(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/marketing/curation-events/${id}/approve`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '승인 실패')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '승인 실패')
    } finally {
      setActionId(null)
    }
  }

  async function handleReject(id: string) {
    if (!window.confirm('이 이벤트를 거절 처리할까요?')) return
    setActionId(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/marketing/curation-events/${id}/reject`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '거절 실패')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '거절 실패')
    } finally {
      setActionId(null)
    }
  }

  async function handleBulkApprove() {
    const ids = [...selectedIds]
    if (!ids.length) return
    setBulkLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/marketing/curation-events/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '일괄 승인 실패')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '일괄 승인 실패')
    } finally {
      setBulkLoading(false)
    }
  }

  function openEdit(row: CurationEventRow) {
    setEditRow(row)
    setEditForm({
      name: row.name,
      city: row.city ?? '',
      description: row.description ?? '',
      appealReason: row.appealReason ?? '',
      type: row.type,
      startMonth: row.startMonth,
      endMonth: row.endMonth,
    })
  }

  async function handleSaveEdit() {
    if (!editRow || !editForm) return
    setEditSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/marketing/curation-events/${editRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '수정 실패')
      setEditRow(null)
      setEditForm(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정 실패')
    } finally {
      setEditSaving(false)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllDrafts() {
    const allSelected = draftIdsOnPage.every((id) => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(draftIdsOnPage))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-bt-title">해외 이벤트 검토</h1>
          <p className="mt-1 text-sm text-bt-body/70">
            Gemini 수집 이벤트를 검토·승인하면 추천 카드 🌐 태그에 노출됩니다. (임시 페이지 — PR 가-7-β에서 본체 통합 예정)
          </p>
        </div>
        <Link
          href="/admin/marketing/trip-recommendations"
          className="rounded-lg border border-bt-border-strong px-3 py-1.5 text-sm hover:bg-bt-surface-soft"
        >
          ← 콘텐츠 자동화
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value || 'all'}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-full px-3 py-1 text-sm ${
              statusFilter === tab.value
                ? 'bg-bt-brand-blue text-white'
                : 'bg-bt-surface-soft text-bt-body hover:bg-bt-border-strong/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-bt-body/70">
          국가
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="rounded border border-bt-border-strong px-2 py-1.5 text-sm"
          >
            <option value="">전체</option>
            {countryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-bt-body/70">
          월 (monthKey)
          <select
            value={monthKeyFilter}
            onChange={(e) => setMonthKeyFilter(e.target.value)}
            className="rounded border border-bt-border-strong px-2 py-1.5 text-sm"
          >
            <option value="">전체</option>
            {monthKeyOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-bt-body/70">
          시즌 카드 연결
          <select
            value={linkedFilter}
            onChange={(e) => setLinkedFilter(e.target.value)}
            className="rounded border border-bt-border-strong px-2 py-1.5 text-sm"
          >
            {LINKED_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-bt-body/70">
          검색 (이름·도시·설명)
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setAppliedSearch(searchDraft.trim())
            }}
            className="rounded border border-bt-border-strong px-2 py-1.5 text-sm"
            placeholder="마쯔리, 불꽃축제…"
          />
        </label>
        <button
          type="button"
          onClick={() => setAppliedSearch(searchDraft.trim())}
          className="rounded-lg bg-bt-brand-blue px-3 py-1.5 text-sm text-white hover:opacity-90"
        >
          검색
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-bt-body/70">
          총 {total}건 · 표시 {events.length}건
        </p>
        {draftIdsOnPage.length > 0 && (
          <>
            <button
              type="button"
              onClick={toggleSelectAllDrafts}
              className="text-sm text-bt-link hover:underline"
            >
              검토 대기 {draftIdsOnPage.length}건 {draftIdsOnPage.every((id) => selectedIds.has(id)) ? '선택 해제' : '전체 선택'}
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0 || bulkLoading}
              onClick={() => void handleBulkApprove()}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
            >
              {bulkLoading ? '승인 중…' : `선택 ${selectedIds.size}건 일괄 승인`}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-bt-body/70">불러오는 중…</p>
      ) : events.length === 0 ? (
        <p className="rounded-lg border border-bt-border-strong bg-white p-6 text-sm text-bt-body/70">
          표시할 이벤트가 없습니다. 콘텐츠 자동화에서 [전체 이벤트 갱신] 후 다시 확인하세요.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-bt-border-strong bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-bt-border-strong bg-bt-surface-soft/50 text-left text-xs text-bt-body/70">
              <tr>
                <th className="px-3 py-2 w-8" />
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">국가</th>
                <th className="px-3 py-2">월</th>
                <th className="px-3 py-2">유형</th>
                <th className="px-3 py-2">연결된 시즌 카드</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">수집일</th>
                <th className="px-3 py-2">작업</th>
              </tr>
            </thead>
            <tbody>
              {events.map((row) => (
                <tr key={row.id} className="border-b border-bt-border-strong/60 last:border-0">
                  <td className="px-3 py-2">
                    {row.status === 'draft' && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        aria-label={`${row.name} 선택`}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-bt-title">{row.name}</div>
                    {row.city && <div className="text-xs text-bt-body/60">{row.city}</div>}
                    {row.appealReason && (
                      <div className="mt-0.5 text-xs text-bt-body/70">{row.appealReason}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">{row.countryCode}</td>
                  <td className="px-3 py-2">
                    {row.monthKey}
                    <span className="text-xs text-bt-body/60">
                      {' '}
                      ({row.startMonth}~{row.endMonth}월)
                    </span>
                  </td>
                  <td className="px-3 py-2">{row.type}</td>
                  <td className="px-3 py-2">
                    {row.linkedSeasonCard ? (
                      <Link
                        href={`/admin/bongsim/monthly-curation?monthKey=${encodeURIComponent(row.linkedSeasonCard.monthKey)}`}
                        className="text-bt-link hover:underline"
                        title={`${row.linkedSeasonCard.monthKey} 시즌 카드`}
                      >
                        <span className="font-medium text-bt-title">{row.linkedSeasonCard.title}</span>
                        <span className="mt-0.5 block text-xs text-bt-body/60">
                          {row.linkedSeasonCard.monthKey}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-bt-body/50">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(row.status)}`}>
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-bt-body/70">
                    {formatDate(row.collectedAt)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {row.status === 'draft' && (
                        <>
                          <button
                            type="button"
                            disabled={actionId === row.id}
                            onClick={() => void handleApprove(row.id)}
                            className="rounded border border-green-600 px-2 py-0.5 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={actionId === row.id}
                            onClick={() => void handleReject(row.id)}
                            className="rounded border border-red-400 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="rounded border border-bt-border-strong px-2 py-0.5 text-xs hover:bg-bt-surface-soft"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editRow && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-bt-title">이벤트 수정</h3>
            <p className="mt-1 text-sm text-bt-body/70">
              {editRow.countryCode} · {editRow.monthKey}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                이름
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1 w-full rounded border border-bt-border-strong px-2 py-1.5"
                />
              </label>
              <label className="block text-sm">
                도시
                <input
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  className="mt-1 w-full rounded border border-bt-border-strong px-2 py-1.5"
                />
              </label>
              <label className="block text-sm">
                유형
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                  className="mt-1 w-full rounded border border-bt-border-strong px-2 py-1.5"
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  시작월
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={editForm.startMonth}
                    onChange={(e) =>
                      setEditForm({ ...editForm, startMonth: Number(e.target.value) || 1 })
                    }
                    className="mt-1 w-full rounded border border-bt-border-strong px-2 py-1.5"
                  />
                </label>
                <label className="block text-sm">
                  종료월
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={editForm.endMonth}
                    onChange={(e) =>
                      setEditForm({ ...editForm, endMonth: Number(e.target.value) || 1 })
                    }
                    className="mt-1 w-full rounded border border-bt-border-strong px-2 py-1.5"
                  />
                </label>
              </div>
              <label className="block text-sm">
                설명
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded border border-bt-border-strong px-2 py-1.5"
                />
              </label>
              <label className="block text-sm">
                어필 포인트
                <textarea
                  value={editForm.appealReason}
                  onChange={(e) => setEditForm({ ...editForm, appealReason: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded border border-bt-border-strong px-2 py-1.5"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={editSaving}
                onClick={() => {
                  setEditRow(null)
                  setEditForm(null)
                }}
                className="rounded-lg border border-bt-border-strong px-3 py-1.5 text-sm hover:bg-bt-surface-soft disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={() => void handleSaveEdit()}
                className="rounded-lg bg-bt-brand-blue px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
              >
                {editSaving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
