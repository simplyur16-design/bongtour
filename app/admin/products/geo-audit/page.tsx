'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminPageHeader from '@/app/admin/components/AdminPageHeader'
import { OVERSEAS_LOCATION_TREE_CLEAN } from '@/lib/overseas-location-tree'
import type { OverseasRegionGroupNode } from '@/lib/overseas-location-tree.types'

type GeoBlock = {
  country: string | null
  city: string | null
  countryKey: string | null
  nodeKey: string | null
  groupKey: string | null
  continent: string | null
  locationMatchConfidence: string | null
  locationMatchSource: string | null
}

type ListItem = {
  id: string
  originSource: string
  title: string
  destinationRaw: string | null
  primaryDestination: string | null
  destination: string | null
  originUrl: string | null
  current: GeoBlock
  suggestion: GeoBlock
  suggestionMatchesKeys: boolean
  lastGeoAuditAt: string | null
  lastGeoAuditedBy: string | null
  geoAuditSkippedAt: string | null
}

type ListResponse = {
  items: ListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
  includeSkipped: boolean
}

type FlatPick = {
  path: string
  groupKey: string
  countryKey: string
  nodeKey: string | null
}

function flattenTree(tree: OverseasRegionGroupNode[]): FlatPick[] {
  const out: FlatPick[] = []
  for (const g of tree) {
    for (const c of g.countries) {
      out.push({
        path: `${g.groupLabel} › ${c.countryLabel} (국가 단위 · 리프 없음)`,
        groupKey: g.groupKey,
        countryKey: c.countryKey,
        nodeKey: null,
      })
      for (const leaf of c.children) {
        out.push({
          path: `${g.groupLabel} › ${c.countryLabel} › ${leaf.nodeLabel}`,
          groupKey: g.groupKey,
          countryKey: c.countryKey,
          nodeKey: leaf.nodeKey,
        })
      }
    }
  }
  return out
}

function GeoBlockView({ label, g }: { label: string; g: GeoBlock }) {
  return (
    <div className="rounded-lg border border-bt-border bg-white p-3 text-sm">
      <div className="mb-2 font-medium text-bt-title">{label}</div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-bt-body">
        <dt className="text-bt-muted">country</dt>
        <dd>{g.country ?? '—'}</dd>
        <dt className="text-bt-muted">city</dt>
        <dd>{g.city ?? '—'}</dd>
        <dt className="text-bt-muted">countryKey</dt>
        <dd className="font-mono text-xs">{g.countryKey ?? '—'}</dd>
        <dt className="text-bt-muted">nodeKey</dt>
        <dd className="font-mono text-xs">{g.nodeKey ?? '—'}</dd>
        <dt className="text-bt-muted">groupKey</dt>
        <dd className="font-mono text-xs">{g.groupKey ?? '—'}</dd>
        <dt className="text-bt-muted">continent</dt>
        <dd className="font-mono text-xs">{g.continent ?? '—'}</dd>
        <dt className="text-bt-muted">신뢰도</dt>
        <dd>{g.locationMatchConfidence ?? '—'}</dd>
        <dt className="text-bt-muted">출처</dt>
        <dd className="break-all">{g.locationMatchSource ?? '—'}</dd>
      </dl>
    </div>
  )
}

export default function GeoAuditPage() {
  const flatPicks = useMemo(() => flattenTree(OVERSEAS_LOCATION_TREE_CLEAN), [])
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [includeSkipped, setIncludeSkipped] = useState(false)
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [pick, setPick] = useState<FlatPick | null>(null)
  const [applyBusy, setApplyBusy] = useState(false)
  const [applyMsg, setApplyMsg] = useState<string | null>(null)
  const [normalizeWarn, setNormalizeWarn] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const u = new URL('/api/admin/products/geo-audit/list', window.location.origin)
      u.searchParams.set('page', String(page))
      u.searchParams.set('limit', String(limit))
      if (includeSkipped) u.searchParams.set('includeSkipped', '1')
      const r = await fetch(u.toString(), { credentials: 'include' })
      if (!r.ok) {
        setErr(`목록 로드 실패 (${r.status})`)
        setData(null)
        return
      }
      const j = (await r.json()) as ListResponse
      setData(j)
      setSelectedId((prev) => {
        if (j.items.length === 0) return null
        if (prev && j.items.some((x) => x.id === prev)) return prev
        return j.items[0]!.id
      })
    } catch {
      setErr('네트워크 오류')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, limit, includeSkipped])

  useEffect(() => {
    void load()
  }, [load])

  const selected = data?.items.find((x) => x.id === selectedId) ?? null

  const filteredPicks = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return flatPicks
    return flatPicks.filter((p) => p.path.toLowerCase().includes(q) || p.groupKey.includes(q) || p.countryKey.includes(q))
  }, [flatPicks, search])

  async function onApply() {
    if (!selected || !pick) return
    setApplyBusy(true)
    setApplyMsg(null)
    setNormalizeWarn(null)
    try {
      const r = await fetch('/api/admin/products/geo-audit/apply', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selected.id,
          groupKey: pick.groupKey,
          countryKey: pick.countryKey,
          nodeKey: pick.nodeKey,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setApplyMsg(typeof j.error === 'string' ? j.error : `적용 실패 (${r.status})`)
        return
      }
      setApplyMsg('저장되었습니다.')
      if (j.normalizeWouldMatchApplied === false) {
        setNormalizeWarn(
          '참고: D-3-FIX 정규화(`normalizeProductGeoForPrisma`)로 재계산하면 키가 달라질 수 있습니다. 의도한 매핑인지 확인하세요.',
        )
      }
      await load()
    } catch {
      setApplyMsg('네트워크 오류')
    } finally {
      setApplyBusy(false)
    }
  }

  async function onSkip() {
    if (!selected) return
    setApplyBusy(true)
    setApplyMsg(null)
    try {
      const r = await fetch('/api/admin/products/geo-audit/skip', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id }),
      })
      if (!r.ok) {
        setApplyMsg('보류 처리 실패')
        return
      }
      setApplyMsg('보류 처리되었습니다. 기본 목록에서는 숨겨집니다.')
      await load()
    } catch {
      setApplyMsg('네트워크 오류')
    } finally {
      setApplyBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <AdminPageHeader
        title="상품 지리 정규화 검수"
        subtitle="등록 완료 해외 상품 중 키·표기가 비어 있거나 영문 슬러그인 행만 표시합니다. 메가메뉴 트리에서 노드를 고르고 적용하세요. 자동 추천은 참고용이며 자동 저장되지 않습니다."
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeSkipped}
            onChange={(e) => {
              setIncludeSkipped(e.target.checked)
              setPage(1)
            }}
          />
          보류 포함
        </label>
        {data != null && (
          <span className="text-bt-muted">
            검수 대상 {data.total}건 · {data.page}/{data.totalPages} 페이지
          </span>
        )}
      </div>

      {err && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <section className="lg:w-[380px] lg:shrink-0">
          <div className="rounded-xl border border-bt-border bg-white p-3 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-bt-title">검수 대상</h2>
            {loading && <p className="text-sm text-bt-muted">불러오는 중…</p>}
            {!loading && data && data.items.length === 0 && (
              <p className="text-sm text-bt-muted">대상 행이 없습니다. (한글·키가 이미 맞춰진 경우 제외)</p>
            )}
            <ul className="max-h-[70vh] space-y-1 overflow-auto pr-1">
              {data?.items.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(row.id)
                      setApplyMsg(null)
                      setNormalizeWarn(null)
                    }}
                    className={`w-full rounded-lg border px-2 py-2 text-left text-sm transition-colors ${
                      row.id === selectedId
                        ? 'border-bt-brand-blue bg-bt-brand-blue-soft'
                        : 'border-transparent hover:bg-bt-surface-soft'
                    }`}
                  >
                    <div className="truncate font-medium text-bt-title">{row.title}</div>
                    <div className="truncate text-xs text-bt-muted">
                      {row.originSource} · {row.current.countryKey ?? '키없음'}
                    </div>
                    {row.suggestionMatchesKeys && (
                      <span className="mt-1 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-900">
                        추천 키 = 현재 키
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {data && data.totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-bt-border pt-3 text-sm">
                <button
                  type="button"
                  disabled={page <= 1}
                  className="rounded border px-2 py-1 disabled:opacity-40"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  이전
                </button>
                <span>
                  {page} / {data.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= data.totalPages}
                  className="rounded border px-2 py-1 disabled:opacity-40"
                  onClick={() => setPage((p) => p + 1)}
                >
                  다음
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="min-w-0 flex-1 space-y-4">
          {!selected ? (
            <p className="text-sm text-bt-muted">행을 선택하세요.</p>
          ) : (
            <>
              <div className="rounded-xl border border-bt-border bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-bt-title">상품 메타</h2>
                <p className="mt-1 text-sm text-bt-body">{selected.title}</p>
                <dl className="mt-3 grid gap-1 text-xs text-bt-muted sm:grid-cols-2">
                  <div>
                    <dt className="inline text-bt-muted">공급사: </dt>
                    <dd className="inline">{selected.originSource}</dd>
                  </div>
                  <div>
                    <dt className="inline text-bt-muted">id: </dt>
                    <dd className="inline font-mono">{selected.id}</dd>
                  </div>
                  {selected.originUrl && (
                    <div className="sm:col-span-2">
                      <a
                        href={selected.originUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-bt-brand-blue underline"
                      >
                        원본 상세 페이지
                      </a>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <span className="text-bt-muted">destinationRaw: </span>
                    {selected.destinationRaw ?? '—'}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-bt-muted">primaryDestination: </span>
                    {selected.primaryDestination ?? '—'}
                  </div>
                </dl>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <GeoBlockView label="현재 DB" g={selected.current} />
                <GeoBlockView label="D-3-FIX 추천 (자동 적용 안 함)" g={selected.suggestion} />
              </div>

              <div className="rounded-xl border border-bt-border bg-white p-4 shadow-sm">
                <h2 className="mb-2 text-sm font-semibold text-bt-title">메가메뉴 트리 선택</h2>
                <p className="mb-3 text-xs text-bt-muted">
                  권역 › 국가 › 리프 경로를 검색하거나 아래 목록에서 고릅니다. 「국가 단위」는 해당 browse 국가 노드만 지정합니다(nodeKey
                  null).
                </p>
                <input
                  type="search"
                  placeholder="경로·슬러그 검색…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="mb-2 w-full rounded border border-bt-border px-3 py-2 text-sm"
                />
                <select
                  className="mb-4 max-h-48 w-full rounded border border-bt-border px-2 py-2 text-sm"
                  size={8}
                  value={
                    pick
                      ? `${pick.groupKey}|${pick.countryKey}|${pick.nodeKey ?? ''}`
                      : ''
                  }
                  onChange={(e) => {
                    const v = e.target.value
                    const [groupKey, countryKey, nodeKeyRaw] = v.split('|')
                    const nodeKey = nodeKeyRaw === '' ? null : nodeKeyRaw
                    const found = flatPicks.find(
                      (p) =>
                        p.groupKey === groupKey && p.countryKey === countryKey && (p.nodeKey ?? '') === (nodeKey ?? ''),
                    )
                    setPick(found ?? null)
                  }}
                >
                  <option value="">— 선택 —</option>
                  {filteredPicks.map((p) => (
                    <option key={`${p.groupKey}|${p.countryKey}|${p.nodeKey ?? ''}`} value={`${p.groupKey}|${p.countryKey}|${p.nodeKey ?? ''}`}>
                      {p.path}
                    </option>
                  ))}
                </select>

                {pick && (
                  <pre className="mb-4 overflow-x-auto rounded bg-bt-surface-soft p-3 text-xs">
                    {JSON.stringify(
                      { groupKey: pick.groupKey, countryKey: pick.countryKey, nodeKey: pick.nodeKey },
                      null,
                      2,
                    )}
                  </pre>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={applyBusy || !pick}
                    onClick={() => void onApply()}
                    className="rounded-lg bg-bt-brand-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    이 매핑 적용
                  </button>
                  <button
                    type="button"
                    disabled={applyBusy}
                    onClick={() => void onSkip()}
                    className="rounded-lg border border-bt-border bg-white px-4 py-2 text-sm disabled:opacity-50"
                  >
                    보류 (목록에서 숨김)
                  </button>
                </div>
                {applyMsg && <p className="mt-2 text-sm text-bt-body">{applyMsg}</p>}
                {normalizeWarn && <p className="mt-2 text-sm text-amber-800">{normalizeWarn}</p>}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
