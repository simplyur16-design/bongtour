'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  matchTokensForCountry,
  matchTokensForGroup,
  matchTokensForLeaf,
  type OverseasCountryNode,
  type OverseasLeafNode,
  type OverseasRegionGroupNode,
} from '@/lib/overseas-location-tree'
import { OVERSEAS_LANDING_SECTIONS } from '@/lib/overseas-landing-copy'
import { overseasCountryRankKey } from '@/lib/hub-explore-click-rank'
import { useHubExploreClickSort } from '@/lib/use-hub-explore-click-sort'
import { HubExploreHorizontalScrollRow } from '@/app/components/travel/hub-explore/HubExploreHorizontalScrollRow'

const PRODUCTS_ANCHOR = 'travel-os-products'

export type OverseasExploreFilter = {
  terms: string[]
  summaryLabel: string
}

type Props = {
  /** auxiliary: 검색 아래 보조 탐색(짧은 카피·여백) */
  layout?: 'full' | 'auxiliary'
  /** true: 상위 `details`에 앵커를 두고, 본 섹션은 하단 보더만 생략 */
  embedded?: boolean
  activeLocationTree: OverseasRegionGroupNode[]
  overseasProductCountForTree: number
  onFilterChange: (next: OverseasExploreFilter) => void
}

function scrollToProducts() {
  document.getElementById(PRODUCTS_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function OverseasCountryCityExplorer({
  layout = 'full',
  embedded = false,
  activeLocationTree,
  overseasProductCountForTree,
  onFilterChange,
}: Props) {
  const first = activeLocationTree[0]
  const [groupKey, setGroupKey] = useState<string>(first?.groupKey ?? '')
  const [countryKey, setCountryKey] = useState<string | null>(null)
  const [leafKey, setLeafKey] = useState<string | null>(null)
  const [scope, setScope] = useState<'none' | 'group' | 'country' | 'leaf'>('none')

  const group = useMemo(
    () => activeLocationTree.find((g) => g.groupKey === groupKey) ?? null,
    [activeLocationTree, groupKey]
  )

  useEffect(() => {
    if (activeLocationTree.length === 0) return
    const ok = activeLocationTree.some((g) => g.groupKey === groupKey)
    if (!ok) {
      const next = activeLocationTree[0]!.groupKey
      setGroupKey(next)
      setCountryKey(null)
      setLeafKey(null)
      setScope('none')
      onFilterChange({ terms: [], summaryLabel: '' })
    }
  }, [activeLocationTree, groupKey, onFilterChange])

  const country = useMemo(() => {
    if (!group || !countryKey) return null
    return group.countries.find((c) => c.countryKey === countryKey) ?? null
  }, [group, countryKey])

  const countryRankKey = useCallback(
    (c: OverseasCountryNode) => (group ? overseasCountryRankKey(group.groupKey, c.countryKey) : ''),
    [group]
  )
  const { ordered: orderedCountries, noteClick: noteCountryClick, bumpId: bumpCountryRankId } =
    useHubExploreClickSort(group?.countries, countryRankKey)

  const applyGroupWhole = useCallback(
    (g: OverseasRegionGroupNode) => {
      setGroupKey(g.groupKey)
      setCountryKey(null)
      setLeafKey(null)
      setScope('group')
      onFilterChange({ terms: matchTokensForGroup(g), summaryLabel: `${g.groupLabel} 전체` })
      scrollToProducts()
    },
    [onFilterChange]
  )

  const applyCountryWhole = useCallback(
    (g: OverseasRegionGroupNode, c: OverseasCountryNode) => {
      bumpCountryRankId(overseasCountryRankKey(g.groupKey, c.countryKey))
      setGroupKey(g.groupKey)
      setCountryKey(c.countryKey)
      setLeafKey(null)
      setScope('country')
      onFilterChange({ terms: matchTokensForCountry(c), summaryLabel: `${g.groupLabel} · ${c.countryLabel} 전체` })
      scrollToProducts()
    },
    [bumpCountryRankId, onFilterChange]
  )

  const applyLeaf = useCallback(
    (g: OverseasRegionGroupNode, c: OverseasCountryNode, leaf: OverseasLeafNode) => {
      bumpCountryRankId(overseasCountryRankKey(g.groupKey, c.countryKey))
      setGroupKey(g.groupKey)
      setCountryKey(c.countryKey)
      setLeafKey(leaf.nodeKey)
      setScope('leaf')
      onFilterChange({
        terms: matchTokensForLeaf(c, leaf),
        summaryLabel: `${g.groupLabel} · ${c.countryLabel} · ${leaf.nodeLabel}`,
      })
      scrollToProducts()
    },
    [bumpCountryRankId, onFilterChange]
  )

  const clearFilter = useCallback(() => {
    setCountryKey(null)
    setLeafKey(null)
    setScope('none')
    onFilterChange({ terms: [], summaryLabel: '' })
  }, [onFilterChange])

  const onGroupSelect = useCallback(
    (g: OverseasRegionGroupNode) => {
      setGroupKey(g.groupKey)
      setCountryKey(null)
      setLeafKey(null)
      setScope('none')
      onFilterChange({ terms: [], summaryLabel: '' })
    },
    [onFilterChange]
  )

  const breadcrumb = useMemo(() => {
    if (!group) return null
    if (scope === 'group' && !countryKey) {
      return { line: `${group.groupLabel} 전체`, pending: false as const }
    }
    if (scope === 'country' && country) {
      return { line: `${group.groupLabel} › ${country.countryLabel} 전체`, pending: false as const }
    }
    if (scope === 'leaf' && country && leafKey) {
      const leaf = country.children.find((l) => l.nodeKey === leafKey)
      if (leaf) {
        return { line: `${group.groupLabel} › ${country.countryLabel} › ${leaf.nodeLabel}`, pending: false as const }
      }
    }
    if (country && scope === 'none') {
      return {
        line: `${group.groupLabel} › ${country.countryLabel}`,
        pending: true as const,
        hint: '아래에서 「국가 전체」 또는 도시·광역 칩을 누르면 상품 필터가 적용됩니다.',
      }
    }
    return null
  }, [group, country, countryKey, leafKey, scope])

  const aux = layout === 'auxiliary'

  return (
    <section
      id={embedded ? undefined : 'travel-os-explore'}
      className={`scroll-mt-24 bg-white ${embedded ? '' : 'border-b border-bt-border'} ${aux ? 'py-6 sm:py-8' : 'py-10 sm:py-12'}`}
      aria-labelledby="travel-os-explore-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-bt-muted">
          {aux ? OVERSEAS_LANDING_SECTIONS.exploreAuxEyebrow : OVERSEAS_LANDING_SECTIONS.exploreEyebrow}
        </p>
        <h2 id="travel-os-explore-heading" className="mt-2 text-2xl font-semibold tracking-tight text-bt-ink sm:text-3xl">
          {aux ? OVERSEAS_LANDING_SECTIONS.exploreAuxTitle : OVERSEAS_LANDING_SECTIONS.exploreTitle}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-bt-muted">
          {aux ? OVERSEAS_LANDING_SECTIONS.exploreAuxLead : OVERSEAS_LANDING_SECTIONS.exploreLead}
        </p>
        {aux ? null : (
          <>
            <p className="mt-2 max-w-3xl text-xs text-bt-subtle">
              권역은 하나투어·모두투어 해외 메뉴 체계를 통합한 운영 기준입니다. 표시는 Bong투어 표준 라벨, 상품 매칭은 공급사 표기(동경·푸껫·씨엠립 등)를
              흡수했습니다.
            </p>
            <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-bt-subtle">
              {OVERSEAS_LANDING_SECTIONS.exploreTreeFootnote(overseasProductCountForTree)}
            </p>
          </>
        )}
        {aux ? (
          <p className="mt-2 text-[11px] text-bt-subtle">
            {OVERSEAS_LANDING_SECTIONS.exploreTreeFootnote(overseasProductCountForTree)}
          </p>
        ) : null}

        {activeLocationTree.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-bt-border bg-bt-surface/90 px-5 py-10 text-center">
            <p className="text-base font-semibold text-bt-ink">{OVERSEAS_LANDING_SECTIONS.exploreEmptyTreeTitle}</p>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-bt-muted">
              {OVERSEAS_LANDING_SECTIONS.exploreEmptyTreeLead}
            </p>
          </div>
        ) : null}

        {breadcrumb ? (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              breadcrumb.pending
                ? 'border-amber-200/90 bg-amber-50/90 text-amber-950'
                : 'border-bt-accent/25 bg-bt-accent-subtle/80 text-bt-ink'
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-bt-subtle">
              {OVERSEAS_LANDING_SECTIONS.exploreBreadcrumbHint}
            </p>
            <p className="mt-1 font-medium tracking-tight">{breadcrumb.line}</p>
            {breadcrumb.pending ? <p className="mt-1 text-xs text-amber-900/85">{breadcrumb.hint}</p> : null}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={clearFilter}
            className="text-xs font-medium text-bt-link underline-offset-2 hover:text-bt-link-hover hover:underline"
          >
            목적지 필터 초기화
          </button>
        </div>

        <div className={`mt-8 ${activeLocationTree.length === 0 ? 'hidden' : ''}`}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-bt-subtle">1. 권역 (공급사 해외 분류 기준)</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeLocationTree.map((g) => {
              const selected = groupKey === g.groupKey
              return (
                <button
                  key={g.groupKey}
                  type="button"
                  onClick={() => onGroupSelect(g)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs font-medium transition sm:text-sm ${
                    selected
                      ? 'border-bt-accent bg-bt-accent-subtle text-bt-ink shadow-sm'
                      : 'border-bt-border bg-bt-surface text-bt-ink hover:border-bt-accent/40'
                  }`}
                >
                  {g.groupLabel}
                  <span className="mt-0.5 block text-[10px] font-normal text-bt-muted">{g.countries.length}개 국가·세부</span>
                </button>
              )
            })}
          </div>
        </div>

        {group && activeLocationTree.length > 0 ? (
          <div className="mt-8">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-bt-subtle">2. 국가 · 세부 권역</h3>
            <HubExploreHorizontalScrollRow className="mt-3">
              {orderedCountries.map((c) => {
                const selected = countryKey === c.countryKey
                return (
                  <button
                    key={c.countryKey}
                    type="button"
                    onClick={() => {
                      noteCountryClick(c)
                      setCountryKey(c.countryKey)
                      setLeafKey(null)
                      setScope('none')
                      onFilterChange({ terms: [], summaryLabel: '' })
                    }}
                    className={`shrink-0 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                      selected
                        ? 'border-bt-accent bg-bt-accent-subtle text-bt-ink shadow-sm'
                        : 'border-bt-border bg-bt-surface text-bt-ink hover:border-bt-accent/40'
                    }`}
                  >
                    {c.countryLabel}
                    <span className="mt-1 block text-[11px] font-normal text-bt-muted">{c.children.length}개 목적지</span>
                  </button>
                )
              })}
            </HubExploreHorizontalScrollRow>
          </div>
        ) : null}

        <div className={`mt-10 rounded-2xl border border-bt-border bg-bt-surface/80 p-5 sm:p-6 ${activeLocationTree.length === 0 ? 'hidden' : ''}`}>
          <h3 className="text-sm font-semibold text-bt-ink">{OVERSEAS_LANDING_SECTIONS.cityPanelTitle}</h3>
          <p className="mt-1 text-xs text-bt-muted">{OVERSEAS_LANDING_SECTIONS.cityHint}</p>

          {!group ? (
            <p className="mt-6 text-sm text-bt-muted">권역을 선택해 주세요.</p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyGroupWhole(group)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    scope === 'group' && !countryKey
                      ? 'border-amber-500/60 bg-amber-50 text-amber-900'
                      : 'border-bt-border bg-white text-bt-ink hover:border-bt-accent/40'
                  }`}
                >
                  {group.groupLabel} 전체
                </button>
              </div>

              {!country ? (
                <p className="mt-6 text-sm text-bt-muted">국가·세부 권역을 선택하면 도시·광역 목적지가 표시됩니다.</p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => group && applyCountryWhole(group, country)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      scope === 'country' && countryKey === country.countryKey && leafKey === null
                        ? 'border-amber-500/60 bg-amber-50 text-amber-900'
                        : 'border-bt-border bg-white text-bt-ink hover:border-bt-accent/40'
                    }`}
                  >
                    {country.countryLabel} 전체
                  </button>
                  {country.children.length === 0 ? (
                    <p className="w-full text-xs leading-relaxed text-bt-muted">{OVERSEAS_LANDING_SECTIONS.countryShallowOnlyHint}</p>
                  ) : null}
                  {country.children.map((leaf) => {
                    const active = scope === 'leaf' && leafKey === leaf.nodeKey && countryKey === country.countryKey
                    return (
                      <button
                        key={leaf.nodeKey}
                        type="button"
                        onClick={() => group && applyLeaf(group, country, leaf)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          active
                            ? 'border-bt-accent bg-bt-accent-subtle text-bt-ink'
                            : 'border-bt-border bg-white text-bt-muted hover:border-bt-accent/40 hover:text-bt-ink'
                        }`}
                      >
                        {leaf.nodeLabel}
                        {leaf.nodeType && leaf.nodeType !== 'city' ? (
                          <span className="ml-1 text-[10px] text-bt-subtle">({leaf.nodeType})</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              )}
              <p className="mt-4 text-[11px] text-bt-subtle sm:hidden">
                목적지가 많을 때는 가로로 스크롤해 선택할 수 있습니다.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
