'use client'

import Link from 'next/link'
import { type FC, useEffect, useId, useMemo, useRef, useState } from 'react'
import { pickPrivateTripOpsHeadline, privateTripHeroCardTitle } from '@/lib/private-trip-hero-ops-ment'
import { useRouter, useSearchParams } from 'next/navigation'
import { getPublicBookableMinYmd } from '@/lib/public-bookable-date'
import {
  browseDestinationDisplayLabelFromBrowseHero,
  buildPublicPageHeroEditorialLineMonthlyStub,
  publicPageHeroMonthPlus,
  type PublicPageHeroTravelScope,
} from '@/lib/public-page-hero-editorial-line'
import {
  dedupePageHeroMonthlyGeminiJobsPreservingOrder,
  pageHeroMonthlyGeminiJobKey,
} from '@/lib/page-hero-monthly-shared'
import type { PageHeroMonthlyGeminiJob } from '@/lib/page-hero-monthly-types'
import type { PrivateTripHeroSlide } from '@/lib/private-trip-hero-types'

const WEEKDAYS_KR = ['일', '월', '화', '수', '목', '금', '토'] as const

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function parseYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const d = new Date(`${ymd}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 검색바 표시: `2026.04.20 (토)` */
function formatDepartBarLabel(ymd: string): string {
  const d = parseYmd(ymd)
  if (!d) return ''
  const w = WEEKDAYS_KR[d.getDay()]
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} (${w})`
}

function buildCalendarCells(viewYear: number, viewMonth1to12: number): { date: Date; inMonth: boolean }[] {
  const first = new Date(viewYear, viewMonth1to12 - 1, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(viewYear, viewMonth1to12, 0).getDate()
  const cells: { date: Date; inMonth: boolean }[] = []
  const prevLast = new Date(viewYear, viewMonth1to12 - 1, 0).getDate()
  for (let i = 0; i < startPad; i++) {
    const day = prevLast - startPad + i + 1
    cells.push({ date: new Date(viewYear, viewMonth1to12 - 2, day), inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(viewYear, viewMonth1to12 - 1, day), inMonth: true })
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const prev = cells[cells.length - 1]!.date
    const next = new Date(prev)
    next.setDate(next.getDate() + 1)
    cells.push({ date: next, inMonth: false })
  }
  return cells
}

type BrowseHeroItem = {
  id: string
  title: string
  originSource: string | null
  primaryDestination: string | null
  bgImageUrl: string | null
  coverImageUrl: string | null
  earliestDeparture: string | null
  /** API/목업에서 누락될 수 있음 — 정렬 시 방어 */
  updatedAt?: string | null
  duration?: string | null
  bgImageSource?: string | null
  bgImageIsGenerated?: boolean | null
}

type ApiOk = {
  ok: true
  items: BrowseHeroItem[]
}

const HERO_FALLBACK =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221280%22 height=%22480%22 viewBox=%220 0 1280 480%22%3E%3Crect width=%221280%22 height=%22480%22 fill=%22%23e2e8f0%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%2294a3b8%22 font-size=%2230%22%3EOverseas%20Hero%3C/text%3E%3C/svg%3E'

function monthKeywordBoost(targetMonth: number, text: string): number {
  const t = text.toLowerCase()
  const spring = /(도쿄|오사카|교토|후쿠오카|벚꽃|대만|홍콩)/
  const summer = /(방콕|다낭|나트랑|보라카이|세부|발리|하와이|괌|사이판)/
  const autumn = /(스위스|프라하|비엔나|파리|로마|런던|유럽)/
  const winter = /(삿포로|홋카이도|북해도|온천|오로라|핀란드|노르웨이)/
  const m = targetMonth
  if ((m >= 3 && m <= 5 && spring.test(t)) || (m >= 6 && m <= 8 && summer.test(t)) || (m >= 9 && m <= 11 && autumn.test(t)) || ((m === 12 || m <= 2) && winter.test(t))) return 24
  return 0
}

function scoreForMonth(item: BrowseHeroItem, targetMonth: number): number {
  let score = 0
  if (item.earliestDeparture) {
    const d = new Date(item.earliestDeparture)
    if (!Number.isNaN(d.getTime())) {
      const m = d.getMonth() + 1
      if (m === targetMonth) score += 70
      else if (m === publicPageHeroMonthPlus(targetMonth, 1) || m === publicPageHeroMonthPlus(targetMonth, -1))
        score += 35
    }
  }
  score += monthKeywordBoost(targetMonth, `${item.primaryDestination ?? ''} ${item.title ?? ''}`)
  return score
}

function pickByBucket(
  items: BrowseHeroItem[],
  month: number,
  need: number,
  usedIds: Set<string>,
  usedRegionCounts: Map<string, number>
): BrowseHeroItem[] {
  const scored = items
    .filter((x) => !usedIds.has(x.id))
    .map((x) => ({ x, s: scoreForMonth(x, month) }))
    .sort((a, b) => {
      const byScore = b.s - a.s
      if (byScore !== 0) return byScore
      const ua = String(a.x.updatedAt ?? '')
      const ub = String(b.x.updatedAt ?? '')
      return ub.localeCompare(ua)
    })

  const picked: BrowseHeroItem[] = []
  for (const row of scored) {
    if (picked.length >= need) break
    const regionKey = browseDestinationDisplayLabelFromBrowseHero(row.x).toLowerCase()
    const used = usedRegionCounts.get(regionKey) ?? 0
    // 같은 도시/국가 최대 2개 hard cap
    if (used >= 2) continue
    picked.push(row.x)
    usedIds.add(row.x.id)
    usedRegionCounts.set(regionKey, used + 1)
  }
  return picked
}

type HeroRow = BrowseHeroItem & {
  slotMonth: number
  headline: string
  travelScope: PublicPageHeroTravelScope
  /**
   * 우리여행 관리자 슬라이드 전용. 정의되면 상품 상세 링크 대신 사용.
   * `''` 이면 이미지에 링크 없음.
   */
  managedHeroHref?: string
}

function heroRowHasDestinationContext(item: BrowseHeroItem): boolean {
  return Boolean((item.primaryDestination ?? '').trim() || (item.title ?? '').trim())
}

/** 목적지 메타가 없으면 Gemini 호출 대상에서 제외(스텁만). */
function geminiJobFromHeroRow(row: HeroRow): PageHeroMonthlyGeminiJob | null {
  if (!heroRowHasDestinationContext(row)) return null
  const destinationDisplay = browseDestinationDisplayLabelFromBrowseHero(row).trim()
  if (!destinationDisplay) return null
  return {
    targetMonth1To12: row.slotMonth,
    destinationDisplay: destinationDisplay.slice(0, 80),
    travelScope: row.travelScope,
  }
}

function buildMonthlyHero(items: BrowseHeroItem[]): HeroRow[] {
  const now = new Date()
  const current = now.getMonth() + 1
  const m0 = current
  const m1 = publicPageHeroMonthPlus(current, 1)
  const m2 = publicPageHeroMonthPlus(current, 2)
  const m3 = publicPageHeroMonthPlus(current, 3)

  const usedIds = new Set<string>()
  const usedRegionCounts = new Map<string, number>()
  const out: BrowseHeroItem[] = []

  // 현재달·+1·+2·+3개월 버킷 (합계 10)
  out.push(...pickByBucket(items, m0, 2, usedIds, usedRegionCounts))
  out.push(...pickByBucket(items, m1, 3, usedIds, usedRegionCounts))
  out.push(...pickByBucket(items, m2, 3, usedIds, usedRegionCounts))
  out.push(...pickByBucket(items, m3, 2, usedIds, usedRegionCounts))

  // fallback: 월 버킷이 비면 전체에서 채움
  if (out.length < 10) {
    for (const item of items) {
      if (out.length >= 10) break
      if (usedIds.has(item.id)) continue
      const regionKey = browseDestinationDisplayLabelFromBrowseHero(item).toLowerCase()
      const used = usedRegionCounts.get(regionKey) ?? 0
      if (used >= 2) continue
      out.push(item)
      usedIds.add(item.id)
      usedRegionCounts.set(regionKey, used + 1)
    }
  }

  return out.slice(0, 10).map((item, idx) => {
    const slotMonth = idx < 2 ? m0 : idx < 5 ? m1 : idx < 8 ? m2 : m3
    const dest = browseDestinationDisplayLabelFromBrowseHero(item)
    return {
      ...item,
      slotMonth,
      travelScope: 'overseas' satisfies PublicPageHeroTravelScope,
      headline: buildPublicPageHeroEditorialLineMonthlyStub({
        targetMonth1To12: slotMonth,
        destinationDisplay: dest,
        verbSlotIndex: idx,
        travelScope: 'overseas',
      }),
    }
  })
}

const PRIVATE_TRIP_HERO_PER_LEG = 5

function takeDistinctHeroCandidates(items: BrowseHeroItem[], max: number): BrowseHeroItem[] {
  const seen = new Set<string>()
  const out: BrowseHeroItem[] = []
  for (const x of items) {
    if (out.length >= max) break
    if (seen.has(x.id)) continue
    seen.add(x.id)
    out.push(x)
  }
  return out
}

/** 단독여행 히어만: 해외 단독·국내 패키지 출처를 교차(최대 각 5, 짝이 맞는 만큼만). */
function buildPrivateTripInterleavedHero(
  overseasItems: BrowseHeroItem[],
  domesticItems: BrowseHeroItem[],
): HeroRow[] {
  const overseas = takeDistinctHeroCandidates(overseasItems, PRIVATE_TRIP_HERO_PER_LEG)
  const domestic = takeDistinctHeroCandidates(domesticItems, PRIVATE_TRIP_HERO_PER_LEG)
  const pairs = Math.min(overseas.length, domestic.length, PRIVATE_TRIP_HERO_PER_LEG)
  const now = new Date()
  const slotMonth = now.getMonth() + 1
  const out: HeroRow[] = []
  for (let i = 0; i < pairs; i++) {
    const oItem = overseas[i]!
    const dItem = domestic[i]!
    out.push({
      ...oItem,
      slotMonth,
      travelScope: 'overseas',
      headline: buildPublicPageHeroEditorialLineMonthlyStub({
        targetMonth1To12: slotMonth,
        destinationDisplay: browseDestinationDisplayLabelFromBrowseHero(oItem),
        verbSlotIndex: i * 2,
        travelScope: 'overseas',
      }),
    })
    out.push({
      ...dItem,
      slotMonth,
      travelScope: 'domestic',
      headline: buildPublicPageHeroEditorialLineMonthlyStub({
        targetMonth1To12: slotMonth,
        destinationDisplay: browseDestinationDisplayLabelFromBrowseHero(dItem),
        verbSlotIndex: i * 2 + 1,
        travelScope: 'domestic',
      }),
    })
  }
  return out
}

function managedPrivateTripSlidesToHeroRows(slides: PrivateTripHeroSlide[]): HeroRow[] {
  const now = new Date()
  const slotMonth = now.getMonth() + 1
  return slides.map((s, i) => {
    const url = s.imageUrl.trim()
    const link = (s.linkHref ?? '').trim()
    const headline =
      (s.headline ?? '').trim() ||
      buildPublicPageHeroEditorialLineMonthlyStub({
        targetMonth1To12: slotMonth,
        destinationDisplay: '맞춤 여행',
        verbSlotIndex: i,
        travelScope: 'overseas',
      })
    const title = (s.caption ?? '').trim() || '우리여행'
    return {
      id: `private-trip-managed-${i}`,
      title,
      originSource: null,
      primaryDestination: null,
      bgImageUrl: url,
      coverImageUrl: url,
      earliestDeparture: null,
      updatedAt: null,
      duration: null,
      bgImageSource: null,
      bgImageIsGenerated: null,
      slotMonth,
      travelScope: 'overseas',
      headline,
      managedHeroHref: link,
    }
  })
}

export type OverseasHeroProps = {
  /**
   * 히어로 카드에 쓸 상품을 DB `listingKind` 로 한정.
   * 단독여행 허브는 `private_trip` 만 (제목 추론 등으로 섞인 일반 해외상품 제외).
   */
  browseListingKind?: 'private_trip'
  /** 비어 있지 않으면 우리여행 히어로는 상품 풀 대신 이 슬라이드만 사용 */
  managedPrivateTripSlides?: PrivateTripHeroSlide[] | null
}

const OverseasHero: FC<OverseasHeroProps> = ({ browseListingKind, managedPrivateTripSlides }) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const departDateId = 'overseas-hero-depart-date'
  const adultId = 'overseas-hero-adult'
  const childId = 'overseas-hero-child'
  const calendarTitleId = useId()
  const calendarPanelId = useId()
  const publicMinYmd = useMemo(() => getPublicBookableMinYmd(), [])
  const sanitizeDepartDate = (raw: string | null): string => {
    const v = (raw ?? '').trim()
    if (!v) return ''
    return v >= publicMinYmd ? v : ''
  }
  const dateWrapRef = useRef<HTMLDivElement>(null)
  const skipFocusOpenRef = useRef(false)
  const [departDate, setDepartDate] = useState(sanitizeDepartDate(searchParams.get('departDate')))
  const [adultCount, setAdultCount] = useState(searchParams.get('adult') ?? '1')
  const [childCount, setChildCount] = useState(searchParams.get('child') ?? '0')
  const [items, setItems] = useState<BrowseHeroItem[]>([])
  const [domesticHeroPool, setDomesticHeroPool] = useState<BrowseHeroItem[]>([])
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [broken, setBroken] = useState<Record<string, boolean>>({})
  const [isPaused, setIsPaused] = useState(false)
  const [lastManualAt, setLastManualAt] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)
  const heroSlideCountRef = useRef(0)
  /** 월·목적지·scope 키별 Gemini 1줄(실패·로딩 중에는 스텁 headline 유지) */
  const [headlineByKey, setHeadlineByKey] = useState<Record<string, string>>({})
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => {
    const fromUrl = parseYmd(sanitizeDepartDate(searchParams.get('departDate')))
    const d = fromUrl ?? new Date()
    return { y: d.getFullYear(), m: d.getMonth() + 1 }
  })

  /** 단독 허브는 검색·날짜 이동도 `/travel/overseas/private-trip` 에 머물게 함 (해외 상품 허브로 튕기지 않음) */
  const hubPath = useMemo(
    () => (browseListingKind === 'private_trip' ? '/travel/overseas/private-trip' : '/travel/overseas'),
    [browseListingKind],
  )

  useEffect(() => {
    const nextDepartRaw = searchParams.get('departDate') ?? ''
    const nextDepart = sanitizeDepartDate(nextDepartRaw)
    setDepartDate(nextDepart)
    setAdultCount(searchParams.get('adult') ?? '1')
    setChildCount(searchParams.get('child') ?? '0')
    const d = parseYmd(nextDepart)
    if (d) setViewMonth({ y: d.getFullYear(), m: d.getMonth() + 1 })
    if (nextDepartRaw && !nextDepart) {
      const p = new URLSearchParams(searchParams.toString())
      p.delete('departDate')
      p.delete('departMonth')
      router.replace(`${hubPath}?${p.toString()}`)
    }
  }, [hubPath, publicMinYmd, router, searchParams])

  useEffect(() => {
    if (!calendarOpen) return
    const onDocDown = (e: MouseEvent) => {
      const el = dateWrapRef.current
      if (el && !el.contains(e.target as Node)) setCalendarOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCalendarOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [calendarOpen])

  const applySearch = (next: { departDate: string; adult: string; child: string }) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('scope', 'overseas')
    p.delete('page')
    if (next.departDate.trim()) {
      p.set('departDate', next.departDate.trim())
      // 기존 browse 흐름 재사용: 월 기준 필터로 연결
      p.set('departMonth', next.departDate.slice(0, 7))
    } else {
      p.delete('departDate')
      p.delete('departMonth')
    }
    const adultNum = Math.max(1, Number.parseInt(next.adult || '1', 10) || 1)
    const childNum = Math.max(0, Number.parseInt(next.child || '0', 10) || 0)
    p.set('adult', String(adultNum))
    p.set('child', String(childNum))
    // 기존 browse API의 pax 필터 경로 재사용
    p.set('pax', String(adultNum + childNum))
    if (browseListingKind === 'private_trip') {
      p.set('listingKind', 'private_trip')
      p.set('type', 'private')
    } else {
      p.delete('listingKind')
      p.delete('type')
    }
    router.replace(`${hubPath}?${p.toString()}`)
  }

  const browseUrl = useMemo(() => {
    const q = new URLSearchParams({
      scope: 'overseas',
      limit: '100',
      sort: 'popular',
    })
    if (browseListingKind === 'private_trip') {
      q.set('listingKind', 'private_trip')
      q.set('type', 'private')
    }
    return `/api/products/browse?${q.toString()}`
  }, [browseListingKind])

  const domesticBrowseUrl = useMemo(
    () =>
      `/api/products/browse?${new URLSearchParams({
        scope: 'domestic',
        limit: '100',
        sort: 'popular',
        listingKind: 'travel',
      }).toString()}`,
    [],
  )

  useEffect(() => {
    let off = false
    const withImage = (rows: BrowseHeroItem[]) =>
      rows.filter((x) => Boolean((x.coverImageUrl ?? x.bgImageUrl ?? '').trim()))
    ;(async () => {
      if (browseListingKind === 'private_trip' && managedPrivateTripSlides && managedPrivateTripSlides.length > 0) {
        if (!off) {
          setItems([])
          setDomesticHeroPool([])
          setLoading(false)
        }
        return
      }
      setLoading(true)
      try {
        if (browseListingKind === 'private_trip') {
          const [resOs, resDom] = await Promise.all([
            fetch(browseUrl, { cache: 'no-store' }),
            fetch(domesticBrowseUrl, { cache: 'no-store' }),
          ])
          const jsonOs = (await resOs.json()) as ApiOk | { ok: false }
          const jsonDom = (await resDom.json()) as ApiOk | { ok: false }
          if (!off) {
            setItems(resOs.ok && 'ok' in jsonOs && jsonOs.ok ? withImage(jsonOs.items ?? []) : [])
            setDomesticHeroPool(resDom.ok && 'ok' in jsonDom && jsonDom.ok ? withImage(jsonDom.items ?? []) : [])
          }
        } else {
          setDomesticHeroPool([])
          const res = await fetch(browseUrl, { cache: 'no-store' })
          const json = (await res.json()) as ApiOk | { ok: false }
          if (!off && res.ok && 'ok' in json && json.ok) {
            setItems(withImage(json.items ?? []))
          } else if (!off) {
            setItems([])
          }
        }
      } catch {
        if (!off) {
          setItems([])
          setDomesticHeroPool([])
        }
      } finally {
        if (!off) setLoading(false)
      }
    })()
    return () => {
      off = true
    }
  }, [browseListingKind, browseUrl, domesticBrowseUrl, managedPrivateTripSlides])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduceMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const heroRowsStub = useMemo(() => {
    if (browseListingKind === 'private_trip' && managedPrivateTripSlides && managedPrivateTripSlides.length > 0) {
      return managedPrivateTripSlidesToHeroRows(managedPrivateTripSlides)
    }
    if (browseListingKind === 'private_trip') {
      return buildPrivateTripInterleavedHero(items, domesticHeroPool)
    }
    return buildMonthlyHero(items)
  }, [browseListingKind, items, domesticHeroPool, managedPrivateTripSlides])

  useEffect(() => {
    if (loading) {
      setHeadlineByKey({})
      return
    }
    if (browseListingKind === 'private_trip') {
      setHeadlineByKey({})
      return
    }
    const rows = heroRowsStub
    setHeadlineByKey({})
    if (rows.length === 0) return
    const jobsRaw: PageHeroMonthlyGeminiJob[] = []
    for (const row of rows) {
      const j = geminiJobFromHeroRow(row)
      if (j) jobsRaw.push(j)
    }
    const jobs = dedupePageHeroMonthlyGeminiJobsPreservingOrder(jobsRaw)
    if (jobs.length === 0) return

    const ac = new AbortController()
    void (async () => {
      try {
        const res = await fetch('/api/public/page-hero-editorial-lines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobs }),
          signal: ac.signal,
        })
        const data = (await res.json()) as {
          ok?: boolean
          jobs?: PageHeroMonthlyGeminiJob[]
          lines?: unknown
        }
        if (ac.signal.aborted) return
        const lineList = data.lines
        const jobList = data.jobs
        if (!data.ok || !Array.isArray(lineList) || !Array.isArray(jobList)) return
        if (lineList.length !== jobList.length) return
        const next: Record<string, string> = {}
        jobList.forEach((j: PageHeroMonthlyGeminiJob, i: number) => {
          const raw = lineList[i]
          const line = typeof raw === 'string' ? raw.trim() : ''
          if (line) next[pageHeroMonthlyGeminiJobKey(j)] = line
        })
        setHeadlineByKey(next)
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (e instanceof Error && e.name === 'AbortError') return
      }
    })()

    return () => ac.abort()
  }, [loading, heroRowsStub, browseListingKind])

  const heroRows = useMemo(() => {
    if (browseListingKind === 'private_trip') {
      return heroRowsStub.map((row, i) => ({
        ...row,
        headline: pickPrivateTripOpsHeadline(row, i),
        title: privateTripHeroCardTitle(row),
      }))
    }
    return heroRowsStub.map((row) => {
      const key = pageHeroMonthlyGeminiJobKey({
        targetMonth1To12: row.slotMonth,
        destinationDisplay: browseDestinationDisplayLabelFromBrowseHero(row).trim(),
        travelScope: row.travelScope,
      })
      const gem = headlineByKey[key]
      return gem ? { ...row, headline: gem } : row
    })
  }, [browseListingKind, headlineByKey, heroRowsStub])

  useEffect(() => {
    setIdx((prev) => {
      const n = heroRows.length
      if (n <= 0) return 0
      return prev % n
    })
  }, [heroRows.length])

  const current = heroRows[idx % Math.max(heroRows.length, 1)] ?? null

  useEffect(() => {
    heroSlideCountRef.current = heroRows.length
    const hoverPausesAutoplay = browseListingKind !== 'private_trip'
    if (heroRows.length <= 1 || (hoverPausesAutoplay && isPaused) || reduceMotion) return
    const t = setInterval(() => {
      // 수동 이동 직후 즉시 자동 전환되는 현상 완화
      if (Date.now() - lastManualAt < 3600) return
      setIdx((v) => {
        const n = heroSlideCountRef.current
        if (n <= 1) return v
        return (v + 1) % n
      })
    }, 5500)
    return () => clearInterval(t)
  }, [heroRows.length, isPaused, reduceMotion, lastManualAt, browseListingKind])

  const todayYmd = useMemo(() => formatYmd(new Date()), [])
  const calendarCells = useMemo(
    () => buildCalendarCells(viewMonth.y, viewMonth.m),
    [viewMonth.y, viewMonth.m]
  )

  const pickDepartDate = (ymd: string) => {
    if (ymd < publicMinYmd) return
    setDepartDate(ymd)
    applySearch({ departDate: ymd, adult: adultCount, child: childCount })
  }

  const shiftViewMonth = (delta: number) => {
    setViewMonth((prev) => {
      let { y, m } = prev
      m += delta
      if (m < 1) {
        m = 12
        y -= 1
      } else if (m > 12) {
        m = 1
        y += 1
      }
      return { y, m }
    })
  }

  const dateField = (
    <div className="relative min-w-0" ref={dateWrapRef}>
      <button
        type="button"
        id={departDateId}
        aria-haspopup="dialog"
        aria-expanded={calendarOpen}
        aria-controls={calendarPanelId}
        aria-label={departDate ? `출발일 ${formatDepartBarLabel(departDate)}` : '출발일 선택'}
        onPointerDown={() => {
          skipFocusOpenRef.current = true
        }}
        onFocus={() => {
          if (skipFocusOpenRef.current) {
            skipFocusOpenRef.current = false
            return
          }
          setCalendarOpen(true)
        }}
        onClick={() => setCalendarOpen((o) => !o)}
        className={`relative flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-bt-ui-accent/25 ${
          calendarOpen
            ? 'border-bt-ui-accent bg-bt-surface-soft ring-2 ring-bt-ui-accent/25'
            : 'border-bt-border bg-white hover:border-bt-accent/35 hover:bg-bt-surface-soft/80'
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${departDate ? 'font-medium text-bt-ink' : 'text-bt-subtle'}`}>
          {departDate ? formatDepartBarLabel(departDate) : '날짜를 선택해 주세요'}
        </span>
        <span className="shrink-0 text-bt-subtle" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-85" aria-hidden>
            <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      {calendarOpen ? (
        <div
          id={calendarPanelId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={calendarTitleId}
          className="absolute left-0 right-0 top-full z-50 mt-1 w-full max-w-[min(100vw-2rem,320px)] rounded-xl border border-bt-border bg-white p-3 shadow-lg sm:left-0 sm:right-auto"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm text-bt-ink hover:bg-bt-surface-soft"
              aria-label="이전 달"
              onClick={() => shiftViewMonth(-1)}
            >
              ‹
            </button>
            <p id={calendarTitleId} className="text-sm font-semibold text-bt-ink">
              {viewMonth.y}년 {viewMonth.m}월
            </p>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm text-bt-ink hover:bg-bt-surface-soft"
              aria-label="다음 달"
              onClick={() => shiftViewMonth(1)}
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium sm:text-xs">
            {WEEKDAYS_KR.map((d, i) => (
              <div
                key={`wd-${d}`}
                className={`py-1 ${i === 0 ? 'text-rose-600' : i === 6 ? 'text-sky-700' : 'text-bt-subtle'}`}
              >
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-0.5">
            {calendarCells.map(({ date, inMonth }) => {
              const ymd = formatYmd(date)
              const dow = date.getDay()
              const isSun = dow === 0
              const isSat = dow === 6
              const isToday = ymd === todayYmd
              const isSelected = ymd === departDate
              const isBlocked = ymd < publicMinYmd
              const weekendCls = isSun ? 'text-rose-600' : isSat ? 'text-sky-700' : 'text-bt-ink'
              return (
                <button
                  key={ymd + String(inMonth)}
                  type="button"
                  disabled={isBlocked}
                  onClick={() => {
                    pickDepartDate(ymd)
                    setCalendarOpen(false)
                  }}
                  className={`flex h-9 min-w-0 items-center justify-center rounded-md text-sm transition-colors disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100 ${
                    isSelected
                      ? 'bg-bt-ui-accent font-semibold text-white hover:bg-bt-ui-accent'
                      : `${inMonth ? weekendCls : 'text-bt-subtle/70'} ${
                          isToday ? 'ring-1 ring-bt-ui-accent/40 ring-inset' : 'hover:bg-bt-surface-soft'
                        }`
                  }`}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )

  return (
    <section className="border-b border-bt-border bg-gradient-to-b from-white to-bt-surface">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-4">
        <div
          className="relative overflow-hidden rounded-xl border border-bt-border bg-bt-surface"
          onMouseEnter={() => {
            if (browseListingKind !== 'private_trip') setIsPaused(true)
          }}
          onMouseLeave={() => {
            if (browseListingKind !== 'private_trip') setIsPaused(false)
          }}
          aria-live={reduceMotion ? 'polite' : 'off'}
        >
          <div className="relative h-[150px] sm:h-[175px] md:h-[200px] lg:h-[22vh] lg:min-h-[180px] lg:max-h-[260px]">
            {loading ? (
              <div className="h-full w-full animate-pulse bg-slate-200/60" />
            ) : !current ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-sm text-bt-subtle">
                <p>이번 달 추천 상품을 준비 중입니다.</p>
                <p className="text-xs">잠시 후 다시 확인해 주세요.</p>
              </div>
            ) : (
              (() => {
                const heroRow = current as HeroRow
                const mh = heroRow.managedHeroHref
                const src =
                  broken[current.id] ? HERO_FALLBACK : current.coverImageUrl ?? current.bgImageUrl ?? HERO_FALLBACK
                const dots =
                  heroRows.length > 1 ? (
                    heroRows.length <= 16 ? (
                      <div className="pointer-events-none absolute right-2 top-2 z-20 flex max-w-[min(100%,20rem)] flex-wrap items-center justify-end gap-1.5">
                        {heroRows.map((_, i) => (
                          <button
                            key={`hero-dot-${i}`}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setIdx(i)
                              setLastManualAt(Date.now())
                            }}
                            className={`pointer-events-auto h-1.5 rounded-full transition-all ${
                              i === idx % heroRows.length ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
                            }`}
                            aria-label={`추천 슬라이드 ${i + 1}${i === idx % heroRows.length ? ' (현재)' : ''}`}
                            aria-current={i === idx % heroRows.length ? 'true' : undefined}
                            aria-pressed={i === idx % heroRows.length}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="pointer-events-none absolute right-2 top-2 z-20 rounded-md bg-black/50 px-2 py-1 text-[11px] font-medium tabular-nums text-white/95">
                        {(idx % heroRows.length) + 1} / {heroRows.length}
                      </div>
                    )
                  ) : null
                const inner = (
                  <>
                    <img
                      src={src}
                      alt=""
                      className="h-full w-full object-cover"
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      fetchPriority={idx === 0 ? 'high' : 'auto'}
                      decoding="async"
                      onError={() => setBroken((prev) => ({ ...prev, [current.id]: true }))}
                    />
                    {dots}
                  </>
                )
                if (mh !== undefined) {
                  if (mh.length > 0) {
                    return (
                      <Link
                        href={mh}
                        className="group relative block h-full w-full"
                        aria-label={current.headline || current.title || '우리여행'}
                      >
                        {inner}
                      </Link>
                    )
                  }
                  return (
                    <div
                      className="group relative block h-full w-full"
                      role="group"
                      aria-label={current.headline || current.title || '우리여행 히어로'}
                    >
                      {inner}
                    </div>
                  )
                }
                return (
                  <Link
                    href={`/products/${current.id}`}
                    className="group relative block h-full w-full"
                    aria-label={`${browseDestinationDisplayLabelFromBrowseHero(current)} ${current.title} 상세 보기`}
                  >
                    {inner}
                  </Link>
                )
              })()
            )}
          </div>
          {!loading && current ? (
            <div className="border-t border-bt-border-soft bg-white px-3 py-2">
              <p className="text-xs font-semibold text-bt-title sm:text-sm">{current.headline}</p>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-bt-meta">{current.title}</p>
            </div>
          ) : null}
        </div>
      </div>

      {browseListingKind === 'private_trip' ? null : (
      <div className="mx-auto max-w-6xl px-4 pb-4 sm:px-6 sm:pb-5">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            applySearch({ departDate, adult: adultCount, child: childCount })
          }}
          className="rounded-xl border border-bt-border bg-white p-3 sm:p-4"
          role="search"
          aria-label="출발일과 성인 아동 인원으로 해외여행 검색"
        >
          <p className="mb-2 text-xs text-bt-subtle">떠나고 싶은 날짜와 인원을 선택해보세요</p>
          {/* 데스크톱: 출발일(라벨+날짜바)을 한 그리드 셀에서 flex 정렬 → 라벨만 아래로 떨어지는 회귀 방지 */}
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr),auto,112px,auto,112px,auto] sm:items-center sm:gap-x-3">
            <div className="flex min-w-0 items-center gap-2">
              <label htmlFor={departDateId} className="shrink-0 text-sm font-medium text-bt-ink">
                출발일
              </label>
              <div className="min-w-0 flex-1">{dateField}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <label htmlFor={adultId} className="shrink-0 self-center text-sm font-medium text-bt-ink">
                성인
              </label>
              <div className="self-center">
                <select
                  id={adultId}
                  value={adultCount}
                  aria-label="성인 인원 선택"
                  onChange={(e) => {
                    const v = e.target.value
                    setAdultCount(v)
                    applySearch({ departDate, adult: v, child: childCount })
                  }}
                  className="w-full rounded-lg border border-bt-border bg-white px-3 py-2 text-sm text-bt-ink focus:border-bt-ui-accent focus:outline-none focus:ring-2 focus:ring-bt-ui-accent/25"
                >
                  {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                    <option key={`adult-${n}`} value={String(n)}>
                      {n}명
                    </option>
                  ))}
                </select>
              </div>
              <label htmlFor={childId} className="shrink-0 self-center text-sm font-medium text-bt-ink">
                아동
              </label>
              <div className="self-center">
                <select
                  id={childId}
                  value={childCount}
                  aria-label="아동 인원 선택"
                  onChange={(e) => {
                    const v = e.target.value
                    setChildCount(v)
                    applySearch({ departDate, adult: adultCount, child: v })
                  }}
                  className="w-full rounded-lg border border-bt-border bg-white px-3 py-2 text-sm text-bt-ink focus:border-bt-ui-accent focus:outline-none focus:ring-2 focus:ring-bt-ui-accent/25"
                >
                  {Array.from({ length: 10 }, (_, i) => i).map((n) => (
                    <option key={`child-${n}`} value={String(n)}>
                      {n}명
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="col-span-2 w-full sm:col-span-1 sm:w-auto sm:self-center">
              <button
                type="submit"
                aria-label="출발 가능한 상품 보기"
                className="inline-flex w-full items-center justify-center rounded-lg border border-bt-border bg-bt-surface px-4 py-2 text-sm font-semibold text-bt-ink hover:border-bt-accent/45 sm:w-auto"
              >
                출발 가능한 상품 보기
              </button>
            </div>
          </div>
        </form>
      </div>
      )}
    </section>
  )
}

export default OverseasHero
