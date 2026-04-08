'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  matchTokensForDomesticArea,
  matchTokensForDomesticGroup,
  matchTokensForDomesticLeaf,
  type DomesticAreaNode,
  type DomesticLeafNode,
  type DomesticRegionGroupNode,
} from '@/lib/domestic-location-tree'
import { DOMESTIC_LANDING_SECTIONS } from '@/lib/domestic-landing-copy'

const PRODUCTS_ANCHOR = 'travel-dm-products'

export type DomesticExploreFilter = {
  terms: string[]
  summaryLabel: string
}

type Props = {
  activeLocationTree: DomesticRegionGroupNode[]
  domesticProductCountForTree: number
  onFilterChange: (next: DomesticExploreFilter) => void
  /** 상단 메뉴·좌측 필터에서 권역 전체 적용 시 트리 UI 동기화 */
  externalApplyWhole?: { groupKey: string; epoch: number } | null
}

function scrollToProducts() {
  document.getElementById(PRODUCTS_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function DomesticRegionExplorer({
  activeLocationTree,
  domesticProductCountForTree,
  onFilterChange,
  externalApplyWhole = null,
}: Props) {
  const first = activeLocationTree[0]
  const [groupKey, setGroupKey] = useState<string>(first?.groupKey ?? '')
  const [areaKey, setAreaKey] = useState<string | null>(null)
  const [leafKey, setLeafKey] = useState<string | null>(null)
  const [scope, setScope] = useState<'none' | 'group' | 'area' | 'leaf'>('none')

  const group = useMemo(
    () => activeLocationTree.find((g) => g.groupKey === groupKey) ?? null,
    [activeLocationTree, groupKey]
  )

  const area = useMemo(() => {
    if (!group || !areaKey) return null
    return group.areas.find((a) => a.areaKey === areaKey) ?? null
  }, [group, areaKey])

  useEffect(() => {
    if (activeLocationTree.length === 0) return
    const ok = activeLocationTree.some((g) => g.groupKey === groupKey)
    if (!ok) {
      setGroupKey(activeLocationTree[0]!.groupKey)
      setAreaKey(null)
      setLeafKey(null)
      setScope('none')
      onFilterChange({ terms: [], summaryLabel: '' })
    }
  }, [activeLocationTree, groupKey, onFilterChange])

  const applyGroupWhole = useCallback(
    (g: DomesticRegionGroupNode) => {
      setGroupKey(g.groupKey)
      setAreaKey(null)
      setLeafKey(null)
      setScope('group')
      onFilterChange({ terms: matchTokensForDomesticGroup(g), summaryLabel: `${g.groupLabel} 전체` })
      scrollToProducts()
    },
    [onFilterChange]
  )

  useEffect(() => {
    if (!externalApplyWhole) return
    const g = activeLocationTree.find((x) => x.groupKey === externalApplyWhole.groupKey)
    if (g) applyGroupWhole(g)
  }, [externalApplyWhole, activeLocationTree, applyGroupWhole])

  const applyAreaWhole = useCallback(
    (g: DomesticRegionGroupNode, a: DomesticAreaNode) => {
      setGroupKey(g.groupKey)
      setAreaKey(a.areaKey)
      setLeafKey(null)
      setScope('area')
      onFilterChange({ terms: matchTokensForDomesticArea(a), summaryLabel: `${g.groupLabel} · ${a.areaLabel} 전체` })
      scrollToProducts()
    },
    [onFilterChange]
  )

  const applyLeaf = useCallback(
    (g: DomesticRegionGroupNode, a: DomesticAreaNode, leaf: DomesticLeafNode) => {
      setGroupKey(g.groupKey)
      setAreaKey(a.areaKey)
      setLeafKey(leaf.nodeKey)
      setScope('leaf')
      onFilterChange({
        terms: matchTokensForDomesticLeaf(a, leaf),
        summaryLabel: `${g.groupLabel} · ${a.areaLabel} · ${leaf.nodeLabel}`,
      })
      scrollToProducts()
    },
    [onFilterChange]
  )

  const clearFilter = useCallback(() => {
    setAreaKey(null)
    setLeafKey(null)
    setScope('none')
    onFilterChange({ terms: [], summaryLabel: '' })
  }, [onFilterChange])

  const onGroupSelect = useCallback(
    (g: DomesticRegionGroupNode) => {
      setGroupKey(g.groupKey)
      setAreaKey(null)
      setLeafKey(null)
      setScope('none')
      onFilterChange({ terms: [], summaryLabel: '' })
    },
    [onFilterChange]
  )

  const breadcrumb = useMemo(() => {
    if (!group) return null
    if (scope === 'group' && !areaKey) {
      return { line: `${group.groupLabel} 전체`, pending: false as const }
    }
    if (scope === 'area' && area) {
      return { line: `${group.groupLabel} › ${area.areaLabel} 전체`, pending: false as const }
    }
    if (scope === 'leaf' && area && leafKey) {
      const leaf = area.children.find((l) => l.nodeKey === leafKey)
      if (leaf) {
        return { line: `${group.groupLabel} › ${area.areaLabel} › ${leaf.nodeLabel}`, pending: false as const }
      }
    }
    if (area && scope === 'none') {
      return {
        line: `${group.groupLabel} › ${area.areaLabel}`,
        pending: true as const,
        hint: '아래에서 「지역 전체」 또는 목적지 칩을 누르면 상품 필터가 적용됩니다.',
      }
    }
    return null
  }, [group, area, areaKey, leafKey, scope])

  return (
    <section
      id="travel-dm-explore"
      className="scroll-mt-24 border-b border-bt-border bg-white py-10 sm:py-12"
      aria-labelledby="travel-dm-explore-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 id="travel-dm-explore-heading" className="bt-wrap mt-2 text-2xl font-black tracking-tight text-bt-title sm:text-3xl">
          {DOMESTIC_LANDING_SECTIONS.exploreTitle}
        </h2>
        <p className="bt-wrap mt-3 max-w-3xl text-sm leading-relaxed text-bt-muted">
          {DOMESTIC_LANDING_SECTIONS.exploreTreeFootnote(domesticProductCountForTree)}
        </p>

        {activeLocationTree.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-bt-border bg-bt-surface/90 px-5 py-10 text-center">
            <p className="text-base font-semibold text-bt-ink">{DOMESTIC_LANDING_SECTIONS.exploreEmptyTreeTitle}</p>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-bt-muted">
              {DOMESTIC_LANDING_SECTIONS.exploreEmptyTreeLead}
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
            <p className="bt-wrap mt-1 font-semibold tracking-tight">{breadcrumb.line}</p>
            {breadcrumb.pending ? <p className="mt-1 text-xs text-amber-900/85">{breadcrumb.hint}</p> : null}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={clearFilter}
            className="text-xs font-medium text-bt-link underline-offset-2 hover:text-bt-link-hover hover:underline"
          >
            지역 필터 초기화
          </button>
        </div>

        <div className={`mt-8 ${activeLocationTree.length === 0 ? 'hidden' : ''}`}>
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
                  <span className="mt-0.5 block text-[10px] font-normal text-bt-muted">{g.areas.length}개 지역·코스</span>
                </button>
              )
            })}
          </div>
        </div>

        {group && activeLocationTree.length > 0 ? (
          <div className="mt-8">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-bt-subtle">2. 지역 · 코스</h3>
            <div className="mt-3 flex gap-3 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible">
              {group.areas.map((a) => {
                const selected = areaKey === a.areaKey
                return (
                  <button
                    key={a.areaKey}
                    type="button"
                    onClick={() => {
                      setAreaKey(a.areaKey)
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
                    {a.areaLabel}
                    <span className="mt-1 block text-[11px] font-normal text-bt-muted">{a.children.length}개 목적지</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <div className={`mt-10 rounded-2xl border border-bt-border bg-bt-surface/80 p-5 sm:p-6 ${activeLocationTree.length === 0 ? 'hidden' : ''}`}>
          <h3 className="text-sm font-semibold text-bt-ink">{DOMESTIC_LANDING_SECTIONS.cityPanelTitle}</h3>
          <p className="mt-1 text-xs text-bt-muted">{DOMESTIC_LANDING_SECTIONS.cityHint}</p>

          {!group ? (
            <p className="mt-6 text-sm text-bt-muted">권역을 선택해 주세요.</p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyGroupWhole(group)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    scope === 'group' && !areaKey
                      ? 'border-amber-500/60 bg-amber-50 text-amber-900'
                      : 'border-bt-border bg-white text-bt-ink hover:border-bt-accent/40'
                  }`}
                >
                  {group.groupLabel} 전체
                </button>
              </div>

              {!area ? (
                <p className="mt-6 text-sm text-bt-muted">지역·코스를 선택하면 목적지 칩이 표시됩니다.</p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => group && applyAreaWhole(group, area)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      scope === 'area' && areaKey === area.areaKey && leafKey === null
                        ? 'border-amber-500/60 bg-amber-50 text-amber-900'
                        : 'border-bt-border bg-white text-bt-ink hover:border-bt-accent/40'
                    }`}
                  >
                    {area.areaLabel} 전체
                  </button>
                  {area.children.length === 0 ? (
                    <p className="w-full text-xs leading-relaxed text-bt-muted">{DOMESTIC_LANDING_SECTIONS.areaShallowOnlyHint}</p>
                  ) : null}
                  {area.children.map((leaf) => {
                    const active = scope === 'leaf' && leafKey === leaf.nodeKey && areaKey === area.areaKey
                    return (
                      <button
                        key={leaf.nodeKey}
                        type="button"
                        onClick={() => group && applyLeaf(group, area, leaf)}
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
              <p className="mt-4 text-[11px] text-bt-subtle sm:hidden">목적지가 많을 때는 가로로 스크롤할 수 있습니다.</p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
