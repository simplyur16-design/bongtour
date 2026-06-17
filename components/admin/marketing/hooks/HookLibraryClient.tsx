'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import HookForm, { type HookFormValues } from './HookForm'

type HookRow = {
  id: string
  hookType: string
  hookText: string
  context: string | null
  category: string | null
  source: string | null
  tags: string[]
  isActive: boolean
  createdAt: string
}

type CollectResult = {
  trendingKeywords: string[]
  totalBlogItems: number
  totalHooksExtracted: number
  goodHooksInserted: number
  badHooksInserted: number
  skippedDuplicates: number
}

const TYPE_TABS: { value: string; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'good', label: '모범' },
  { value: 'bad', label: '금지' },
]

const CATEGORIES = ['package', 'tip', 'season', 'comparison', 'emotion', 'etc']

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export default function HookLibraryClient() {
  const [tabType, setTabType] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [items, setItems] = useState<HookRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [collecting, setCollecting] = useState(false)
  const [collectResult, setCollectResult] = useState<CollectResult | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editRow, setEditRow] = useState<HookRow | null>(null)
  const [patchingId, setPatchingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = new URLSearchParams()
      if (tabType) q.set('hookType', tabType)
      if (categoryFilter) q.set('category', categoryFilter)
      if (sourceFilter) q.set('source', sourceFilter)
      if (appliedSearch) q.set('search', appliedSearch)
      if (activeOnly) q.set('isActive', 'true')
      const res = await fetch(`/api/admin/marketing/hooks?${q}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '목록 조회 실패')
      setItems(data.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록 조회 실패')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [tabType, categoryFilter, sourceFilter, appliedSearch, activeOnly])

  useEffect(() => {
    void load()
  }, [load])

  async function patchHook(id: string, body: Record<string, unknown>) {
    setPatchingId(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/marketing/hooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '수정 실패')
      setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...data.item } : r)))
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정 실패')
    } finally {
      setPatchingId(null)
    }
  }

  async function deleteHook(id: string) {
    if (!confirm('이 후킹을 삭제할까요?')) return
    setError('')
    try {
      const res = await fetch(`/api/admin/marketing/hooks/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '삭제 실패')
      setItems((prev) => prev.filter((r) => r.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  async function runCollect() {
    if (
      !confirm(
        '네이버 트렌드 + 블로그 검색 + Gemini로 후킹을 자동 수집합니다.\n1회 약 300원 비용이 발생할 수 있으며 2–3분 소요됩니다.\n계속할까요?',
      )
    ) {
      return
    }
    setCollecting(true)
    setCollectResult(null)
    setError('')
    try {
      const res = await fetch('/api/admin/marketing/hooks/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topKeywordGroups: 3, itemsPerKeyword: 20 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '수집 실패')
      setCollectResult(data as CollectResult)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '수집 실패')
    } finally {
      setCollecting(false)
    }
  }

  async function submitForm(values: HookFormValues) {
    const tags = values.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const payload = {
      hookText: values.hookText,
      hookType: values.hookType,
      category: values.category || null,
      context: values.context || null,
      tags,
      isActive: values.isActive,
    }
    if (editRow) {
      const res = await fetch(`/api/admin/marketing/hooks/${editRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '수정 실패')
    } else {
      const res = await fetch('/api/admin/marketing/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, source: 'manual' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '등록 실패')
    }
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-bt-title">후킹 라이브러리</h1>
          <p className="mt-1 text-sm text-bt-body/70">
            카드뉴스·블로그 생성 시 참조하는 모범/금지 후킹 카피
          </p>
        </div>
        <Link href="/admin/marketing" className="text-sm text-bt-brand-blue hover:underline">
          ← 마케팅 개요
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={collecting}
          onClick={() => void runCollect()}
          className="rounded-lg bg-bt-brand-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {collecting ? '수집 중… (2–3분)' : '네이버 트렌드 자동 수집'}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditRow(null)
            setFormOpen(true)
          }}
          className="rounded-lg border border-bt-border-strong bg-white px-4 py-2 text-sm font-medium hover:bg-bt-surface-soft"
        >
          수동 추가
        </button>
      </div>

      {collectResult && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <p className="font-medium">수집 완료</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>키워드: {collectResult.trendingKeywords.join(', ')}</li>
            <li>블로그 글 {collectResult.totalBlogItems}건 분석</li>
            <li>
              추출 {collectResult.totalHooksExtracted}건 → 모범 {collectResult.goodHooksInserted} / 금지{' '}
              {collectResult.badHooksInserted} 등록 (중복 스킵 {collectResult.skippedDuplicates})
            </li>
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-bt-border-strong pb-3">
        {TYPE_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTabType(t.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              tabType === t.value
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
          카테고리
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded border border-bt-border-strong px-2 py-1.5 text-sm"
          >
            <option value="">전체</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-bt-body/80">
          출처
          <input
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            placeholder="naver_blog_search, manual"
            className="rounded border border-bt-border-strong px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-bt-body/80">
          검색 (hookText)
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setAppliedSearch(searchDraft.trim())
            }}
            className="rounded border border-bt-border-strong px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => setAppliedSearch(searchDraft.trim())}
          className="rounded border border-bt-border-strong px-3 py-1.5 text-sm hover:bg-bt-surface-soft"
        >
          검색
        </button>
        <label className="flex items-center gap-2 text-sm text-bt-body/80">
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
          활성만
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-bt-body/70">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-bt-border-strong bg-white p-8 text-center text-sm text-bt-body/70">
          등록된 후킹이 없습니다. 자동 수집 또는 수동 추가로 시작하세요.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-bt-border-strong bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-bt-border-strong bg-bt-surface-soft text-xs text-bt-body/70">
              <tr>
                <th className="px-3 py-2 font-medium">후킹</th>
                <th className="px-3 py-2 font-medium">유형</th>
                <th className="px-3 py-2 font-medium">카테고리</th>
                <th className="px-3 py-2 font-medium">출처</th>
                <th className="px-3 py-2 font-medium">활성</th>
                <th className="px-3 py-2 font-medium">등록일</th>
                <th className="px-3 py-2 font-medium">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bt-border-strong">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-bt-surface-soft/50">
                  <td className="max-w-xs px-3 py-2 font-medium text-bt-title">{row.hookText}</td>
                  <td className="px-3 py-2">
                    <select
                      value={row.hookType}
                      disabled={patchingId === row.id}
                      onChange={(e) =>
                        void patchHook(row.id, { hookType: e.target.value as 'good' | 'bad' })
                      }
                      className="rounded border border-bt-border-strong px-1.5 py-0.5 text-xs"
                    >
                      <option value="good">모범</option>
                      <option value="bad">금지</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={row.category ?? ''}
                      disabled={patchingId === row.id}
                      onChange={(e) =>
                        void patchHook(row.id, { category: e.target.value || null })
                      }
                      className="rounded border border-bt-border-strong px-1.5 py-0.5 text-xs"
                    >
                      <option value="">—</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs text-bt-body/70">{row.source ?? '—'}</td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={row.isActive}
                      disabled={patchingId === row.id}
                      onChange={(e) => void patchHook(row.id, { isActive: e.target.checked })}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-bt-body/70">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditRow(row)
                          setFormOpen(true)
                        }}
                        className="text-xs text-bt-brand-blue hover:underline"
                      >
                        편집
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteHook(row.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <HookForm
        open={formOpen}
        title={editRow ? '후킹 수정' : '후킹 수동 추가'}
        submitLabel={editRow ? '저장' : '등록'}
        initial={
          editRow
            ? {
                hookText: editRow.hookText,
                hookType: editRow.hookType as 'good' | 'bad',
                category: editRow.category ?? '',
                tags: (editRow.tags ?? []).join(', '),
                context: editRow.context ?? '',
                isActive: editRow.isActive,
              }
            : undefined
        }
        onClose={() => {
          setFormOpen(false)
          setEditRow(null)
        }}
        onSubmit={submitForm}
      />
    </div>
  )
}
