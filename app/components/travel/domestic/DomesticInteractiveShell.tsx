'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import HomeProductPickSection from '@/app/components/home/HomeProductPickSection'
import DomesticRegionExplorer, { type DomesticExploreFilter } from '@/app/components/travel/domestic/DomesticRegionExplorer'
import DomesticRefineSidebar from '@/app/components/travel/domestic/DomesticRefineSidebar'
import { DOMESTIC_LANDING_SECTIONS } from '@/lib/domestic-landing-copy'
import { DOMESTIC_NAV_PILLARS, parseDomesticUrlNav, type DomesticPillarId } from '@/lib/domestic-landing-nav-data'
import {
  buildDomesticSpecialAndRefinePredicate,
  DEFAULT_DOMESTIC_REFINE,
  type DomesticRefineState,
} from '@/lib/domestic-landing-refine'
import {
  domesticDisplayCategoryIsSpecialTheme,
  domesticProductMatchesBus,
  domesticProductMatchesShip,
  domesticProductMatchesTrain,
} from '@/lib/domestic-public-browse-match'
import { TRAVEL_DOMESTIC_PRODUCT_LEAD, TRAVEL_DOMESTIC_PRODUCT_TITLE } from '@/lib/main-hub-copy'
import type { GalleryProduct } from '@/app/api/gallery/route'
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

function getTermsForSecond(pillarId: 'schedule', secondKey: string): string[] {
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
  const [domesticTransportNav, setDomesticTransportNav] = useState<'bus' | 'train' | 'ship' | null>(null)
  const [domesticSpecialThemeNav, setDomesticSpecialThemeNav] = useState(false)
  const [entryRegionGroupKey, setEntryRegionGroupKey] = useState<string | null>(null)
  const [refine, setRefineState] = useState<DomesticRefineState>(DEFAULT_DOMESTIC_REFINE)
  const [sidebarScheduleKey, setSidebarScheduleKey] = useState('')
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
        setDomesticTransportNav(null)
        setDomesticSpecialThemeNav(false)
        setSidebarScheduleKey('')
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
        setDomesticSpecialThemeNav(false)
        setNavProductTerms(parsed.terms)
        setNavScheduleStrictTerms(parsed.pillar === 'schedule' ? parsed.terms : [])
        if (parsed.pillar === 'bus') setDomesticTransportNav('bus')
        else if (parsed.pillar === 'train') setDomesticTransportNav('train')
        else if (parsed.pillar === 'ship') setDomesticTransportNav('ship')
        else setDomesticTransportNav(null)
        return
      }
      if (parsed.kind === 'special_theme') {
        setActivePillar('special_theme')
        setNavProductTerms([])
        setNavScheduleStrictTerms([])
        setDomesticTransportNav(null)
        setDomesticSpecialThemeNav(true)
        setExplore({ terms: [], summaryLabel: '' })
        setEntryRegionGroupKey(null)
        setRefine({ regionGroupKey: null })
        setExternalExplorerApply(null)
        return
      }
    },
    [activeLocationTree, setRefine]
  )

  useEffect(() => {
    const parsed = parseDomesticUrlNav(initialDmPillar, initialDmItem)
    if (parsed) applyParsedNav(parsed)
  }, [initialDmPillar, initialDmItem, applyParsedNav])

  const onExploreChange = useCallback(
    (next: DomesticExploreFilter) => {
      setExplore(next)
      if (next.terms.length === 0) {
        setEntryRegionGroupKey(null)
        setRefine({ regionGroupKey: null })
      }
    },
    [setRefine]
  )

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

  const themeFilterTerms = useMemo(() => {
    const merged = [...navProductTerms, ...sidebarScheduleTerms]
    return Array.from(new Set(merged))
  }, [navProductTerms, sidebarScheduleTerms])

  const scheduleStrictTerms = useMemo(() => {
    const fromSidebar = sidebarScheduleTerms
    return Array.from(new Set([...navScheduleStrictTerms, ...fromSidebar]))
  }, [navScheduleStrictTerms, sidebarScheduleTerms])

  const domesticRowFilter = useMemo(() => {
    const base = buildDomesticSpecialAndRefinePredicate(refine, null)
    return (p: GalleryProduct) => {
      if (!base(p)) return false
      if (domesticSpecialThemeNav && !domesticDisplayCategoryIsSpecialTheme(p.displayCategory)) return false
      if (domesticTransportNav === 'bus' && !domesticProductMatchesBus({ title: p.title, includedText: p.includedText }))
        return false
      if (domesticTransportNav === 'train' && !domesticProductMatchesTrain({ title: p.title, includedText: p.includedText }))
        return false
      if (domesticTransportNav === 'ship' && !domesticProductMatchesShip({ title: p.title, includedText: p.includedText }))
        return false
      return true
    }
  }, [refine, domesticSpecialThemeNav, domesticTransportNav])

  const productLead = useMemo(() => {
    const base = TRAVEL_DOMESTIC_PRODUCT_LEAD
    if (domesticTransportNav === 'bus') return `${base} · 버스여행 키워드로 좁혀 보고 있습니다.`
    if (domesticTransportNav === 'train') return `${base} · 기차·철도 키워드로 좁혀 보고 있습니다.`
    if (domesticTransportNav === 'ship') return `${base} · 선박·크루즈·페리 키워드로 좁혀 보고 있습니다.`
    if (domesticSpecialThemeNav) return `${base} · displayCategory에 「국내특별테마」가 있는 상품만 보고 있습니다.`
    if (activePillar !== 'region' && themeFilterTerms.length > 0) {
      return `${base} ${DOMESTIC_LANDING_SECTIONS.productFilterHintActive(themeFilterTerms.slice(0, 3).join(' · '))}`
    }
    if (explore.terms.length > 0) {
      return `${base} ${DOMESTIC_LANDING_SECTIONS.productFilterHintActive(explore.summaryLabel)}`
    }
    return `${base} ${DOMESTIC_LANDING_SECTIONS.productFilterHintAll}`
  }, [domesticTransportNav, domesticSpecialThemeNav, activePillar, themeFilterTerms, explore.terms.length, explore.summaryLabel])

  return (
    <>
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
          />
        }
      />

      {postProductSlot}
    </>
  )
}
