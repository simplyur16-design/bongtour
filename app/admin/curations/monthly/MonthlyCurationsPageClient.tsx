'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import AdminPageHeader from '../../components/AdminPageHeader'
import MonthlyCurationEditor from '@/components/admin/MonthlyCurationEditor'
import MonthlyCurationTable from '@/components/admin/MonthlyCurationTable'
import type { AdminMonthlyCurationListItem } from '@/lib/admin-curation'
import { getSeoulYearMonthNow } from '@/lib/monthly-curation'

function buildListQueryString(searchParams: URLSearchParams): string {
  const p = new URLSearchParams()
  const scope = searchParams.get('scope')
  const status = searchParams.get('status')
  const isActive = searchParams.get('isActive')
  const yearMonth = searchParams.get('yearMonth')
  if (scope) p.set('scope', scope)
  if (status) p.set('status', status)
  if (isActive) p.set('isActive', isActive)
  if (yearMonth) p.set('yearMonth', yearMonth)
  return p.toString()
}

export default function MonthlyCurationsPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams() ?? new URLSearchParams()
  const qsKey = searchParams.toString()

  const [rows, setRows] = useState<AdminMonthlyCurationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create')
  const [editingRow, setEditingRow] = useState<AdminMonthlyCurationListItem | null>(null)
  const [prefillTemplate, setPrefillTemplate] = useState<AdminMonthlyCurationListItem | null>(null)

  const scope = searchParams.get('scope') ?? ''
  const status = searchParams.get('status') ?? ''
  const isActive = searchParams.get('isActive') ?? ''
  const yearMonthFilter = searchParams.get('yearMonth') ?? ''

  const setFilter = useCallback(
    (key: 'scope' | 'status' | 'isActive' | 'yearMonth', value: string) => {
      const p = new URLSearchParams(searchParams.toString())
      if (!value) p.delete(key)
      else p.set(key, value)
      router.replace(`/admin/curations/monthly?${p.toString()}`)
    },
    [router, searchParams]
  )

  const fetchList = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    const q = buildListQueryString(searchParams)
    fetch(`/api/admin/curations/monthly${q ? `?${q}` : ''}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          items?: AdminMonthlyCurationListItem[]
          error?: string
        }
        if (!res.ok) {
          setLoadError(data.error ?? '목록을 불러오지 못했습니다.')
          setRows([])
          return
        }
        setRows(Array.isArray(data.items) ? data.items : [])
      })
      .catch(() => {
        setLoadError('네트워크 오류가 발생했습니다.')
        setRows([])
      })
      .finally(() => setLoading(false))
  }, [searchParams])

  useEffect(() => {
    fetchList()
  }, [fetchList, qsKey])

  const defaultYearMonthForCreate = useMemo(() => {
    if (yearMonthFilter.trim()) return yearMonthFilter.trim()
    return getSeoulYearMonthNow()
  }, [yearMonthFilter])

  const defaultScopeForCreate = useMemo(() => {
    if (scope === 'domestic' || scope === 'overseas') return scope
    return 'domestic'
  }, [scope])

  const openCreate = useCallback(() => {
    setEditorMode('create')
    setEditingRow(null)
    setPrefillTemplate(null)
    setEditorOpen(true)
  }, [])

  const openEdit = useCallback((row: AdminMonthlyCurationListItem) => {
    setEditorMode('edit')
    setEditingRow(row)
    setEditorOpen(true)
  }, [])

  const fillFromFirstRow = useCallback(() => {
    const first = rows[0]
    if (!first) return
    setEditorMode('create')
    setEditingRow(null)
    setPrefillTemplate(first)
    setEditorOpen(true)
  }, [rows])

  const onSaved = useCallback(() => {
    fetchList()
  }, [fetchList])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1400px] p-6">
        <div className="mb-4">
          <Link href="/admin" className="text-sm text-gray-500 hover:text-[#0f172a]">
            ← 대시보드
          </Link>
        </div>

        <AdminPageHeader
          title="레거시 월 카드 (MonthlyCurationItem)"
          subtitle="공개 시즌 추천의 기준 축은 해외 콘텐츠 CMS의 시즌 추천(MonthlyCurationContent)입니다. 이 화면은 예전 구조화 카드 API용 데이터이며, 사이드 메뉴에서는 숨겨 두었습니다."
        />

        <section className="mb-4 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <p className="font-medium">메인 연결 요약</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed">
            <li>
              노출 후보: <strong>published</strong> + <strong>isActive ON</strong> (둘 다 만족)
            </li>
            <li>메인 페이지는 <code className="rounded bg-white/70 px-1">getSeoulYearMonthNow()</code> 등으로 달을 정해 API를 호출합니다 — 다른 월이면 그 요청에는 안 나갑니다.</li>
            <li>국내 섹션은 <code className="rounded bg-white/70 px-1">scope=domestic</code>, 국외는 <code className="rounded bg-white/70 px-1">scope=overseas</code> 기준입니다.</li>
          </ul>
        </section>

        <section className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-800">필터</h2>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex min-w-[140px] flex-col gap-1">
              <label htmlFor="f-scope" className="text-xs font-medium text-gray-600">
                국내/국외
              </label>
              <select
                id="f-scope"
                value={scope}
                onChange={(e) => setFilter('scope', e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-2 text-sm"
              >
                <option value="">전체</option>
                <option value="domestic">국내</option>
                <option value="overseas">국외</option>
              </select>
            </div>
            <div className="flex min-w-[120px] flex-col gap-1">
              <label htmlFor="f-status" className="text-xs font-medium text-gray-600">
                게시 상태
              </label>
              <select
                id="f-status"
                value={status}
                onChange={(e) => setFilter('status', e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-2 text-sm"
              >
                <option value="">전체</option>
                <option value="draft">초안</option>
                <option value="published">게시</option>
              </select>
            </div>
            <div className="flex min-w-[120px] flex-col gap-1">
              <label htmlFor="f-active" className="text-xs font-medium text-gray-600">
                활성
              </label>
              <select
                id="f-active"
                value={isActive}
                onChange={(e) => setFilter('isActive', e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-2 text-sm"
              >
                <option value="">전체</option>
                <option value="true">ON</option>
                <option value="false">OFF</option>
              </select>
            </div>
            <div className="flex min-w-[140px] flex-col gap-1">
              <label htmlFor="f-ym" className="text-xs font-medium text-gray-600">
                yearMonth
              </label>
              <input
                id="f-ym"
                type="text"
                placeholder="2025-03"
                value={yearMonthFilter}
                onChange={(e) => setFilter('yearMonth', e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-2 font-mono text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2 pb-0.5">
              <button
                type="button"
                onClick={openCreate}
                className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
              >
                새 카드
              </button>
              {rows.length > 0 && (
                <button
                  type="button"
                  onClick={fillFromFirstRow}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  title="목록 첫 행의 텍스트·유형을 복사해 새 카드로 엽니다"
                >
                  첫 행 참고해 새 카드
                </button>
              )}
            </div>
          </div>
        </section>

        {loadError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</div>
        )}

        <MonthlyCurationTable rows={rows} loading={loading} onEdit={openEdit} />

        <MonthlyCurationEditor
          open={editorOpen}
          mode={editorMode}
          defaults={{ yearMonth: defaultYearMonthForCreate, scope: defaultScopeForCreate }}
          prefillFrom={prefillTemplate}
          row={editingRow}
          onClose={() => {
            setEditorOpen(false)
            setEditingRow(null)
            setPrefillTemplate(null)
          }}
          onSaved={onSaved}
        />
      </div>
    </div>
  )
}
