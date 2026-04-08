'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import HomeProductPickSection from '@/app/components/home/HomeProductPickSection'
import DomesticRegionExplorer, { type DomesticExploreFilter } from '@/app/components/travel/domestic/DomesticRegionExplorer'
import DomesticTravelSubMainNav, { type DomesticNavApply } from '@/app/components/travel/domestic/DomesticTravelSubMainNav'
import DomesticRefineSidebar from '@/app/components/travel/domestic/DomesticRefineSidebar'
import { DOMESTIC_LANDING_SECTIONS } from '@/lib/domestic-landing-copy'
import {
  DOMESTIC_NAV_PILLARS,
  parseDomesticUrlNav,
  type DomesticPillarId,
  type DomesticSpecialMode,
} from '@/lib/domestic-landing-nav-data'
import {
  buildDomesticSpecialAndRefinePredicate,
  DEFAULT_DOMESTIC_REFINE,
  type DomesticRefineState,
} from '@/lib/domestic-landing-refine'
import { TRAVEL_DOMESTIC_PRODUCT_LEAD, TRAVEL_DOMESTIC_PRODUCT_TITLE } from '@/lib/main-hub-copy'
import type { DomesticRegionGroupNode } from '@/lib/domestic-location-tree'
import { matchTokensForDomesticGroup } from '@/lib/domestic-location-tree'

type Props = {
  postProductSlot: ReactNode
  activeLocationTree: DomesticRegionGroupNode[]
  domesticProductCountForTree: number
  productsQueryFailed?: boolean
  initialDmPillar?: string
  initialDmItem?: string
}

function getTermsForSecond(pillarId: 'schedule' | 'theme' | 'audience', secondKey: string): string[] {
  const pillar = DOMESTIC_NAV_PILLARS.find((p) => p.id === pillarId)
  const row = pillar?.termSecond?.find((t) => t.key === secondKey)
  return row?.terms ?? []
}

export default function DomesticInteractiveShell({
  postProductSlot,
  activeLocationTree,
  domesticProductCountForTree,
  productsQueryFailed = false,
  initialDmPillar,
  initialDmItem,
}: Props) {
  const [explore, setExplore] = useState<DomesticExploreFilter>({ terms: [], summaryLabel: '' })
  const [activePillar, setActivePillar] = useState<DomesticPillarId>('region')
  const [navProductTerms, setNavProductTerms] = useState<string[]>([])
  const [navScheduleStrictTerms, setNavScheduleStrictTerms] = useState<string[]>([])
  const [specialMode, setSpecialMode] = useState<DomesticSpecialMode | null>(null)
  const [entryRegionGroupKey, setEntryRegionGroupKey] = useState<string | null>(null)
  const [refine, setRefineState] = useState<DomesticRefineState>(DEFAULT_DOMESTIC_REFINE)
  const [sidebarScheduleKey, setSidebarScheduleKey] = useState('')
  const [sidebarThemeKey, setSidebarThemeKey] = useState('')
  const [sidebarAudienceKey, setSidebarAudienceKey] = useState('')
  const [externalExplorerApply, setExternalExplorerApply] = useState<{ groupKey: string; epoch: number } | null>(
    null
  )

  const setRefine = useCallback((patch: Partial<DomesticRefineState>) => {
    setRefineState((r) => ({ ...r, ...patch }))
  }, [])

  const applyParsedNav = useCallback(
    (parsed: NonNullable<ReturnType<typeof parseDomesticUrlNav>>) => {
      if (parsed.kind === 'region') {
        setActivePillar('region')
        setNavProductTerms([])
        setNavScheduleStrictTerms([])
        setSpecialMode(null)
        setSidebarScheduleKey('')
        setSidebarThemeKey('')
        setSidebarAudienceKey('')
        if (parsed.groupKey) {
          const g = activeLocationTree.find((x) => x.groupKey === parsed.groupKey)
          if (g) {
            setExplore({ terms: matchTokensForDomesticGroup(g), summaryLabel: parsed.summaryLabel })
            setEntryRegionGroupKey(parsed.groupKey)
            setRefine({ regionGroupKey: parsed.groupKey })
            setExternalExplorerApply((x) => ({
              groupKey: parsed.groupKey!,
              epoch: (x?.epoch ?? 0) + 1,
            }))
          }
        } else if (parsed.destinationTerms?.length) {
          setExplore({ terms: parsed.destinationTerms, summaryLabel: parsed.summaryLabel })
          setEntryRegionGroupKey(null)
          setRefine({ regionGroupKey: null })
          setExternalExplorerApply(null)
        }
        return
      }
      if (parsed.kind === 'terms') {
        setActivePillar(parsed.pillar)
        setExplore({ terms: [], summaryLabel: '' })
        setEntryRegionGroupKey(null)
        setRefine({ regionGroupKey: null })
        setExternalExplorerApply(null)
        setSpecialMode(null)
        setNavProductTerms(parsed.terms)
        setNavScheduleStrictTerms(parsed.pillar === 'schedule' ? parsed.terms : [])
        return
      }
      if (parsed.kind === 'special') {
        setActivePillar('specials')
        setNavProductTerms([])
        setNavScheduleStrictTerms([])
        setSpecialMode(parsed.mode)
        setExplore({ terms: [], summaryLabel: '' })
        setEntryRegionGroupKey(null)
        setRefine({ regionGroupKey: null })
        setExternalExplorerApply(null)
        if (parsed.scrollTo === 'curation') {
          window.requestAnimationFrame(() =>
            document.getElementById('travel-dm-curation')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          )
        }
        return
      }
    },
    [activeLocationTree, setRefine]
  )

  useEffect(() => {
    const parsed = parseDomesticUrlNav(initialDmPillar, initialDmItem)
    if (parsed) applyParsedNav(parsed)
  }, [initialDmPillar, initialDmItem, applyParsedNav])

  const onNavApply = useCallback(
    (a: DomesticNavApply) => {
      if (a.kind === 'region') {
        applyParsedNav({
          kind: 'region',
          groupKey: a.groupKey,
          destinationTerms: a.destinationTerms,
          summaryLabel: a.summaryLabel,
        })
        document.getElementById('travel-dm-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      if (a.kind === 'terms') {
        applyParsedNav({ kind: 'terms', pillar: a.pillar, terms: a.terms, summaryLabel: a.summaryLabel })
        document.getElementById('travel-dm-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      applyParsedNav({
        kind: 'special',
        mode: a.mode,
        summaryLabel: a.summaryLabel,
        scrollTo: a.scrollTo,
      })
      document.getElementById('travel-dm-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [applyParsedNav]
  )

  const onExploreChange = useCallback((next: DomesticExploreFilter) => {
    setExplore(next)
    if (next.terms.length === 0) {
      setEntryRegionGroupKey(null)
      setRefine({ regionGroupKey: null })
    }
  }, [setRefine])

  const onPickRegionGroup = useCallback(
    (key: string | '') => {
      if (!key) {
        setExplore({ terms: [], summaryLabel: '' })
        setRefine({ regionGroupKey: null })
        setEntryRegionGroupKey(null)
        setExternalExplorerApply(null)
        return
      }
      const g = activeLocationTree.find((x) => x.groupKey === key)
      if (g) {
        setExplore({ terms: matchTokensForDomesticGroup(g), summaryLabel: `${g.groupLabel} 전체` })
        setRefine({ regionGroupKey: key })
        setEntryRegionGroupKey(key)
        setExternalExplorerApply((x) => ({ groupKey: key, epoch: (x?.epoch ?? 0) + 1 }))
      }
    },
    [activeLocationTree, setRefine]
  )

  const sidebarScheduleTerms = useMemo(
    () => (sidebarScheduleKey ? getTermsForSecond('schedule', sidebarScheduleKey) : []),
    [sidebarScheduleKey]
  )
  const sidebarThemeTerms = useMemo(
    () => (sidebarThemeKey ? getTermsForSecond('theme', sidebarThemeKey) : []),
    [sidebarThemeKey]
  )
  const sidebarAudienceTerms = useMemo(
    () => (sidebarAudienceKey ? getTermsForSecond('audience', sidebarAudienceKey) : []),
    [sidebarAudienceKey]
  )

  const themeFilterTerms = useMemo(() => {
    const merged = [
      ...navProductTerms,
      ...sidebarThemeTerms,
      ...sidebarAudienceTerms,
      ...sidebarScheduleTerms,
    ]
    return Array.from(new Set(merged))
  }, [navProductTerms, sidebarThemeTerms, sidebarAudienceTerms, sidebarScheduleTerms])

  const scheduleStrictTerms = useMemo(() => {
    const fromSidebar = sidebarScheduleTerms
    return Array.from(new Set([...navScheduleStrictTerms, ...fromSidebar]))
  }, [navScheduleStrictTerms, sidebarScheduleTerms])

  const domesticRowFilter = useMemo(
    () => buildDomesticSpecialAndRefinePredicate(refine, specialMode),
    [refine, specialMode]
  )

  const productLead = useMemo(() => {
    const base = TRAVEL_DOMESTIC_PRODUCT_LEAD
    if (specialMode) {
      return `${base} ${DOMESTIC_LANDING_SECTIONS.productLeadSpecials(specialMode)}`
    }
    if (activePillar !== 'region' && themeFilterTerms.length > 0) {
      return `${base} ${DOMESTIC_LANDING_SECTIONS.productFilterHintActive(themeFilterTerms.slice(0, 3).join(' · '))}`
    }
    if (explore.terms.length > 0) {
      return `${base} ${DOMESTIC_LANDING_SECTIONS.productFilterHintActive(explore.summaryLabel)}`
    }
    return `${base} ${DOMESTIC_LANDING_SECTIONS.productFilterHintAll}`
  }, [specialMode, activePillar, themeFilterTerms, explore.terms.length, explore.summaryLabel])

  return (
    <>
      <DomesticTravelSubMainNav onApply={onNavApply} />

      {productsQueryFailed ? (
        <div className="mx-auto max-w-6xl border-b border-amber-200 bg-amber-50/90 px-4 py-3 text-center text-sm text-amber-950 sm:px-6">
          등록 상품 정보를 불러오지 못했습니다. 아래 지역 탐색·상담 가능 일정은 일부 제한될 수 있습니다.
        </div>
      ) : null}

      {!productsQueryFailed && domesticProductCountForTree === 0 ? (
        <div className="mx-auto max-w-6xl border-b border-bt-border bg-bt-surface/60 px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-bt-border bg-white px-5 py-8 text-center">
            <p className="text-base font-semibold text-bt-ink">등록된 여행상품이 아직 없습니다.</p>
            <p className="mt-3 text-sm leading-relaxed text-bt-muted">준비 중인 상품은 순차적으로 업데이트됩니다.</p>
            <p className="mt-4 text-sm leading-relaxed text-bt-muted">
              <Link href="/inquiry?type=travel&source=/travel/domestic" className="font-bold text-bt-link underline-offset-2 hover:underline">
                상담 신청
              </Link>
            </p>
          </div>
        </div>
      ) : null}

      <DomesticRegionExplorer
        activeLocationTree={activeLocationTree}
        domesticProductCountForTree={domesticProductCountForTree}
        onFilterChange={onExploreChange}
        externalApplyWhole={externalExplorerApply}
      />

      <HomeProductPickSection
        market="domestic"
        sectionId="travel-dm-products"
        eyebrow=""
        title={TRAVEL_DOMESTIC_PRODUCT_TITLE}
        lead=""
        footnote={null}
        destinationFilterTerms={explore.terms}
        themeFilterTerms={themeFilterTerms}
        domesticBrowsePillar={activePillar}
        domesticRowFilter={domesticRowFilter}
        domesticScheduleStrictTerms={scheduleStrictTerms}
        aside={
          <DomesticRefineSidebar
            tree={activeLocationTree}
            refine={refine}
            setRefine={setRefine}
            entryRegionGroupKey={entryRegionGroupKey}
            onPickRegionGroup={onPickRegionGroup}
            sidebarScheduleKey={sidebarScheduleKey}
            setSidebarScheduleKey={setSidebarScheduleKey}
            sidebarThemeKey={sidebarThemeKey}
            setSidebarThemeKey={setSidebarThemeKey}
            sidebarAudienceKey={sidebarAudienceKey}
            setSidebarAudienceKey={setSidebarAudienceKey}
          />
        }
      />

      {postProductSlot}
    </>
  )
}
