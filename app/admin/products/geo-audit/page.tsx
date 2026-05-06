'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminPageHeader from '@/app/admin/components/AdminPageHeader'
import { OVERSEAS_LOCATION_TREE_CLEAN } from '@/lib/overseas-location-tree'
import type { OverseasRegionGroupNode } from '@/lib/overseas-location-tree.types'

type CountryTagRow = {
  countryKey: string
  nodeKey: string | null
  groupKey: string | null
  isPrimary: boolean
  sortOrder: number
}

/** 제목만으로 다국가 패키지 의심(운영자 확인용, 자동 판정 아님) */
function titleSuggestsMultiCountry(title: string): boolean {
  const t = title.trim()
  if (!t) return false
  if (/\d+\s*개국/.test(t)) return true
  if (/\d+\s*국\b/.test(t) && /(일주|여행|투어|팩|패키지|일정)/.test(t)) return true
  if (/(두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*국|다국|복수|연계.*국|N국/i.test(t)) return true
  return false
}

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
  countryTags: CountryTagRow[]
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

function flatPickKey(p: FlatPick) {
  return `${p.groupKey}|${p.countryKey}|${p.nodeKey ?? ''}`
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
  const selectorTree = OVERSEAS_LOCATION_TREE_CLEAN
  const flatPicks = useMemo(() => flattenTree(selectorTree), [selectorTree])
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [includeSkipped, setIncludeSkipped] = useState(false)
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [pick, setPick] = useState<FlatPick | null>(null)
  /** G-4: 보조 태그(대표와 중복 불가) */
  const [secondaryPicks, setSecondaryPicks] = useState<FlatPick[]>([])
  const [secondaryDraftKey, setSecondaryDraftKey] = useState('')
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

  useEffect(() => {
    if (!data || !selectedId) {
      setSecondaryPicks([])
      return
    }
    const row = data.items.find((x) => x.id === selectedId)
    const tags = row?.countryTags ?? []
    if (!tags.length) {
      setSecondaryPicks([])
      return
    }
    const picks: FlatPick[] = []
    for (const t of tags) {
      if (t.isPrimary) continue
      const gk = (t.groupKey ?? '').trim()
      if (!gk) continue
      const fp = flatPicks.find(
        (p) =>
          p.groupKey === gk &&
          p.countryKey === t.countryKey &&
          (p.nodeKey ?? '') === (t.nodeKey ?? ''),
      )
      if (fp) picks.push(fp)
    }
    setSecondaryPicks(picks)
  }, [selectedId, data, flatPicks])

  const filteredPicks = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return flatPicks
    return flatPicks.filter((p) => p.path.toLowerCase().includes(q) || p.groupKey.includes(q) || p.countryKey.includes(q))
  }, [flatPicks, search])

  function addSecondaryDraft() {
    if (!secondaryDraftKey || !pick) return
    const [groupKey, countryKey, nodeKeyRaw] = secondaryDraftKey.split('|')
    const nodeKey = nodeKeyRaw === '' ? null : nodeKeyRaw
    const found = flatPicks.find(
      (p) =>
        p.groupKey === groupKey && p.countryKey === countryKey && (p.nodeKey ?? '') === (nodeKey ?? ''),
    )
    if (!found) return
    if (flatPickKey(found) === flatPickKey(pick)) return
    setSecondaryPicks((prev) => {
      if (prev.some((p) => flatPickKey(p) === flatPickKey(found))) return prev
      return [...prev, found]
    })
    setSecondaryDraftKey('')
  }

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
          primary: {
            groupKey: pick.groupKey,
            countryKey: pick.countryKey,
            nodeKey: pick.nodeKey,
          },
          secondary: secondaryPicks.map((p) => ({
            groupKey: p.groupKey,
            countryKey: p.countryKey,
            nodeKey: p.nodeKey,
          })),
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        const err = typeof j.error === 'string' ? j.error : `적용 실패 (${r.status})`
        const reason = typeof (j as { reason?: unknown }).reason === 'string' ? String((j as { reason: string }).reason) : ''
        setApplyMsg(reason ? `${err}: ${reason}` : err)
        return
      }
      const sec = typeof j.secondaryTagsApplied === 'number' ? j.secondaryTagsApplied : 0
      const pt = j.primaryCountryTagInserted === true
      setApplyMsg(
        sec > 0
          ? `저장되었습니다. 보조 태그 ${sec}건${pt ? ' + 대표 태그(동기화)' : ''}.`
          : '저장되었습니다. (보조 태그 없음 — 기존 보조 태그는 모두 제거됨)',
      )
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
        subtitle="등록 완료 해외 상품 중 키·표기가 비어 있거나 영문 슬러그인 행만 표시합니다. 적용(Apply)은 메가메뉴 코드 트리(`lib/overseas-location-tree`) 선택이 유효해야 합니다. 자동 추천(D-3-FIX)은 참고용이며 자동 저장되지 않습니다."
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
                      setSecondaryDraftKey('')
                    }}
                    className={`w-full rounded-lg border px-2 py-2 text-left text-sm transition-colors ${
                      row.id === selectedId
                        ? 'border-bt-brand-blue bg-bt-brand-blue-soft'
                        : 'border-transparent hover:bg-bt-surface-soft'
                    } ${
                      titleSuggestsMultiCountry(row.title) ? 'border-l-4 border-l-amber-400 pl-1.5' : ''
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
                    {titleSuggestsMultiCountry(row.title) && (
                      <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-950">
                        다국가 문구 감지
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

              {titleSuggestsMultiCountry(selected.title) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950 shadow-sm">
                  <p className="font-semibold">다국가 문구가 제목에 포함된 것으로 보입니다.</p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed">
                    <li>
                      <strong>경유·환승·공항 트랜짓</strong>만 있는 국가는 다국가 태그에 넣지 않습니다. 실제 도착·관광·숙박하는 국가만
                      보조 태그로 추가하세요.
                    </li>
                    <li>진짜 다국가 패키지면, 방문하는 모든 국가를 보조 태그에 넣어 메가메뉴·Browse OR 매칭에 반영합니다.</li>
                    <li>최종 판단은 운영자가 행별로 적용합니다.</li>
                  </ul>
                </div>
              )}

              <div className="rounded-xl border border-bt-border bg-white p-4 shadow-sm">
                <h2 className="mb-2 text-sm font-semibold text-bt-title">대표(primary) — 메가메뉴 트리</h2>
                <p className="mb-3 text-xs text-bt-muted">
                  권역 › 국가 › 리프 경로를 검색하거나 아래 목록에서 고릅니다. 「국가 단위」는 해당 browse 국가 노드만 지정합니다(nodeKey
                  null). 적용 시 <code className="rounded bg-bt-surface-soft px-1">Product</code> 단일 컬럼(country, city,
                  countryKey, nodeKey, groupKey, continent)이 이 선택으로 갱신됩니다.
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

                <div className="mb-6 rounded-lg border border-dashed border-bt-border bg-bt-surface-soft/50 p-4">
                  <h3 className="text-sm font-semibold text-bt-title">보조 국가·도시 태그 (다국가)</h3>
                  <p className="mt-1 text-xs text-bt-muted">
                    실제 방문국을 트리에서 고른 뒤 「추가」합니다. 순서가 sortOrder가 됩니다. 대표와 동일한 노드는 서버에서 자동
                    제외됩니다. 보조가 없으면 기존 <code className="rounded bg-white px-1">ProductCountryTag</code> 행은 전부
                    삭제됩니다(단일 국가와 동일).
                  </p>
                  {secondaryPicks.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {secondaryPicks.map((p, idx) => (
                        <li
                          key={flatPickKey(p)}
                          className="flex items-start justify-between gap-2 rounded border border-bt-border bg-white px-3 py-2 text-xs"
                        >
                          <span>
                            <span className="text-bt-muted">{idx + 1}. </span>
                            {flatPicks.find((x) => flatPickKey(x) === flatPickKey(p))?.path ?? flatPickKey(p)}
                          </span>
                          <button
                            type="button"
                            className="shrink-0 text-red-600 hover:underline"
                            onClick={() => setSecondaryPicks((prev) => prev.filter((x) => flatPickKey(x) !== flatPickKey(p)))}
                          >
                            × 삭제
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <label className="mb-1 block text-[11px] font-medium text-bt-muted">보조 노드 선택</label>
                      <select
                        className="w-full rounded border border-bt-border px-2 py-2 text-sm"
                        value={secondaryDraftKey}
                        onChange={(e) => setSecondaryDraftKey(e.target.value)}
                      >
                        <option value="">— 노드 선택 후 추가 —</option>
                        {filteredPicks.map((p) => (
                          <option key={`sec-${flatPickKey(p)}`} value={flatPickKey(p)}>
                            {p.path}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={!secondaryDraftKey || !pick}
                      onClick={() => addSecondaryDraft()}
                      className="rounded-lg border border-bt-border bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
                    >
                      + 추가
                    </button>
                  </div>
                </div>

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
