'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminPageHeader from '@/app/admin/components/AdminPageHeader'
import {
  MasterCityMultiPicker,
  MasterCountryMultiPicker,
  MasterPrimaryGeoPicker,
  resolveMasterPrimaryFromRow,
  type MasterPrimaryValue,
  type MasterTreeContinent,
} from '@/components/admin/MasterGeoSelectors'

type CountryTagRow = {
  countryKey: string
  nodeKey: string | null
  groupKey: string | null
  isPrimary: boolean
  sortOrder: number
  koreanLabel?: string | null
}

type CityTagRow = {
  cityKey: string
  isPrimary: boolean
  sortOrder: number
  koreanLabel?: string | null
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
  continentKey?: string | null
  cityKey?: string | null
  locationMatchConfidence: string | null
  locationMatchSource: string | null
}

type SuggestionMaster = {
  continentKey: string | null
  countryKey: string | null
  cityKey: string | null
  reasons: unknown
}

type SuggestionMasterValidated = {
  continent: boolean
  country: boolean
  city: boolean
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
  suggestionMaster: SuggestionMaster
  suggestionMasterValidated: SuggestionMasterValidated
  lastGeoAuditAt: string | null
  lastGeoAuditedBy: string | null
  geoAuditSkippedAt: string | null
  countryTags: CountryTagRow[]
  cityTags: CityTagRow[]
}

type ListResponse = {
  items: ListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
  includeSkipped: boolean
}

const EMPTY_PRIMARY: MasterPrimaryValue = { continentKey: '', countryKey: '', cityKey: null }

function suggestionToPrimary(selected: ListItem): MasterPrimaryValue | null {
  const sm = selected.suggestionMaster
  const v = selected.suggestionMasterValidated
  if (!sm?.continentKey?.trim() || !sm?.countryKey?.trim()) return null
  if (!v?.continent || !v?.country) return null
  const cityKey = sm.cityKey?.trim() || null
  if (cityKey && !v.city) {
    return { continentKey: sm.continentKey.trim(), countryKey: sm.countryKey.trim(), cityKey: null }
  }
  return {
    continentKey: sm.continentKey.trim(),
    countryKey: sm.countryKey.trim(),
    cityKey,
  }
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
        <dt className="text-bt-muted">continentKey</dt>
        <dd className="font-mono text-xs">{g.continentKey ?? '—'}</dd>
        <dt className="text-bt-muted">countryKey</dt>
        <dd className="font-mono text-xs">{g.countryKey ?? '—'}</dd>
        <dt className="text-bt-muted">cityKey</dt>
        <dd className="font-mono text-xs">{g.cityKey ?? '—'}</dd>
        <dt className="text-bt-muted">nodeKey</dt>
        <dd className="font-mono text-xs">{g.nodeKey ?? '—'}</dd>
        <dt className="text-bt-muted">groupKey</dt>
        <dd className="font-mono text-xs">{g.groupKey ?? '—'}</dd>
        <dt className="text-bt-muted">continent (탭)</dt>
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
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [includeSkipped, setIncludeSkipped] = useState(false)
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [masterTree, setMasterTree] = useState<{ continents: MasterTreeContinent[] } | null>(null)
  const [masterErr, setMasterErr] = useState<string | null>(null)

  const [primary, setPrimary] = useState<MasterPrimaryValue>(EMPTY_PRIMARY)
  const [secondaryCountries, setSecondaryCountries] = useState<string[]>([])
  const [secondaryCities, setSecondaryCities] = useState<string[]>([])

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

  useEffect(() => {
    void fetch('/api/admin/master-tree', { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<{ continents: MasterTreeContinent[] }>
      })
      .then((j) => {
        setMasterTree(j)
        setMasterErr(null)
      })
      .catch(() => {
        setMasterTree(null)
        setMasterErr('마스터 트리를 불러오지 못했습니다.')
      })
  }, [])

  const selected = data?.items.find((x) => x.id === selectedId) ?? null

  useEffect(() => {
    if (!selected) {
      setSecondaryCountries([])
      setSecondaryCities([])
      return
    }
    const ctags = [...(selected.countryTags ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
    setSecondaryCountries(ctags.filter((t) => !t.isPrimary).map((t) => t.countryKey))
    const citytags = [...(selected.cityTags ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
    setSecondaryCities(citytags.filter((t) => !t.isPrimary).map((t) => t.cityKey))
  }, [selectedId, selected])

  useEffect(() => {
    if (!selected) {
      setPrimary(EMPTY_PRIMARY)
      return
    }
    if (!masterTree?.continents?.length) {
      return
    }
    const resolved = resolveMasterPrimaryFromRow(masterTree.continents, {
      continentKey: selected.current.continentKey ?? null,
      countryKey: selected.current.countryKey ?? null,
      cityKey: selected.current.cityKey ?? null,
    })
    const fromSuggestion = suggestionToPrimary(selected)
    if (resolved?.continentKey) {
      setPrimary(resolved)
    } else if (fromSuggestion) {
      setPrimary(fromSuggestion)
    } else {
      setPrimary(EMPTY_PRIMARY)
    }
  }, [selected, masterTree, selectedId])

  async function onApply() {
    if (!selected) return
    if (!primary.continentKey || !primary.countryKey) {
      setApplyMsg('권역·국가를 선택하세요.')
      return
    }
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
            continentKey: primary.continentKey,
            countryKey: primary.countryKey,
            cityKey: primary.cityKey,
          },
          secondaryCountries: secondaryCountries.map((countryKey, i) => ({
            countryKey,
            sortOrder: i + 1,
          })),
          secondaryCities: secondaryCities.map((cityKey, i) => ({
            cityKey,
            sortOrder: i + 1,
          })),
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        const errMsg = typeof j.error === 'string' ? j.error : `적용 실패 (${r.status})`
        const reason = typeof (j as { reason?: unknown }).reason === 'string' ? String((j as { reason: string }).reason) : ''
        setApplyMsg(reason ? `${errMsg}: ${reason}` : errMsg)
        return
      }
      const secC = typeof j.secondaryCountriesApplied === 'number' ? j.secondaryCountriesApplied : 0
      const secCi = typeof j.secondaryCitiesApplied === 'number' ? j.secondaryCitiesApplied : 0
      const pt = j.primaryTagInserted === true
      const parts: string[] = ['저장되었습니다.']
      if (secC > 0) parts.push(`보조 국가 ${secC}건${pt ? ' + 대표 국가 태그' : ''}`)
      if (secCi > 0) parts.push(`보조 도시 ${secCi}건`)
      if (secC === 0 && secCi === 0) parts.push('보조 태그 없음 — 기존 보조 태그는 모두 제거됨')
      setApplyMsg(parts.join(' '))
      if (j.normalizeWouldMatchApplied === false) {
        setNormalizeWarn(
          '참고: D-3-FIX 정규화(`normalizeProductGeoForPrisma`)로 재계산하면 트리 키가 달라질 수 있습니다. 의도한 매핑인지 확인하세요.',
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

  const sm = selected?.suggestionMaster
  const smv = selected?.suggestionMasterValidated

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <AdminPageHeader
        title="상품 지리 정규화 검수"
        subtitle="등록 완료 해외 상품 중 마스터 키·표기가 비어 있거나 영문 슬러그·권역명(country)인 행만 표시합니다. 대표 위치는 Continent → Country → City 마스터로 고르고, 실제 방문국·방문도시만 보조 태그로 추가합니다. 트리 슬러그(groupKey/nodeKey/continent 탭)는 적용 시 G-3 폴백용으로 자동 보강됩니다."
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
      {masterErr && <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">{masterErr}</div>}

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
                    } ${titleSuggestsMultiCountry(row.title) ? 'border-l-4 border-l-amber-400 pl-1.5' : ''}`}
                  >
                    <div className="truncate font-medium text-bt-title">{row.title}</div>
                    <div className="truncate text-xs text-bt-muted">
                      {row.originSource} · {row.current.continentKey ?? '—'} / {row.current.cityKey ?? '—'}
                    </div>
                    {row.suggestionMatchesKeys && (
                      <span className="mt-1 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-900">
                        추천 트리 키 = 현재 트리 키
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

              <div className="grid gap-4 lg:grid-cols-2">
                <GeoBlockView label="현재 DB" g={selected.current} />
                <GeoBlockView label="D-3-FIX 추천 (트리, 자동 적용 안 함)" g={selected.suggestion} />
              </div>

              {sm && (
                <div className="rounded-lg border border-bt-border bg-white p-3 text-sm">
                  <div className="mb-2 font-medium text-bt-title">마스터 추천 (normalize + 매핑, 자동 적용 안 함)</div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-bt-muted">continentKey</dt>
                    <dd className="font-mono">{sm.continentKey ?? '—'}</dd>
                    <dt className="text-bt-muted">countryKey</dt>
                    <dd className="font-mono">{sm.countryKey ?? '—'}</dd>
                    <dt className="text-bt-muted">cityKey</dt>
                    <dd className="font-mono">{sm.cityKey ?? '—'}</dd>
                  </dl>
                  {smv && (
                    <p className="mt-2 text-xs text-bt-muted">
                      DB 검증: 권역 {smv.continent ? '✓' : '✗'} · 국가 {smv.country ? '✓' : '✗'} · 도시{' '}
                      {sm.cityKey ? (smv.city ? '✓' : '✗') : '(없음)'}
                    </p>
                  )}
                </div>
              )}

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
                <h2 className="mb-2 text-sm font-semibold text-bt-title">대표(primary) — 마스터</h2>
                <p className="mb-3 text-xs text-bt-muted">
                  권역·국가는 필수입니다. 도시는 없을 수 있습니다. 적용 시 <code className="rounded bg-bt-surface-soft px-1">Product</code>{' '}
                  의 <code className="rounded bg-bt-surface-soft px-1">continentKey</code>, <code className="rounded bg-bt-surface-soft px-1">countryKey</code>,{' '}
                  <code className="rounded bg-bt-surface-soft px-1">cityKey</code> 및 한글 <code className="rounded bg-bt-surface-soft px-1">country</code>/
                  <code className="rounded bg-bt-surface-soft px-1">city</code>가 마스터 라벨로 갱신됩니다.
                </p>
                {!masterTree?.continents?.length ? (
                  <p className="text-sm text-bt-muted">마스터 트리를 불러오는 중…</p>
                ) : (
                  <MasterPrimaryGeoPicker continents={masterTree.continents} value={primary} onChange={setPrimary} />
                )}

                <pre className="mt-4 overflow-x-auto rounded bg-bt-surface-soft p-3 text-xs">
                  {JSON.stringify(primary, null, 2)}
                </pre>

                <div className="mt-6 space-y-6">
                  <MasterCountryMultiPicker
                    continents={masterTree?.continents ?? []}
                    primaryCountryKey={primary.countryKey}
                    value={secondaryCountries}
                    onChange={setSecondaryCountries}
                  />
                  <MasterCityMultiPicker
                    continents={masterTree?.continents ?? []}
                    primaryCityKey={primary.cityKey}
                    value={secondaryCities}
                    onChange={setSecondaryCities}
                  />
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={applyBusy || !primary.continentKey || !primary.countryKey || !masterTree}
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
