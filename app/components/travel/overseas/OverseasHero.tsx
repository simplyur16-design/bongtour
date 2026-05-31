'use client'

import Link from 'next/link'
import SafeImage from '@/app/components/SafeImage'
import { type FC, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import OverseasDestinationAutocomplete from '@/components/travel/overseas/OverseasDestinationAutocomplete'
import { getPublicBookableMinYmd } from '@/lib/public-bookable-date'
import { countryDisplayNameFromBrowseParam } from '@/lib/overseas-browse-country-hero'
import { overseasBrowseLabelFromParams } from '@/lib/overseas-mega-menu-location-suggestions'
import type { OverseasLocationSuggestion } from '@/lib/overseas-mega-menu-location-suggestions'
import {
  findSeasonDestinationSlideForBrowseCountry,
  type OverseasHubDestinationHeroSlide,
} from '@/lib/overseas-hub-season-destination-hero-shared'
import OverseasCountryHeroBanner from '@/components/travel/overseas/OverseasCountryHeroBanner'

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

const HERO_FALLBACK =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221280%22 height=%22480%22 viewBox=%220 0 1280 480%22%3E%3Crect width=%221280%22 height=%22480%22 fill=%22%23e2e8f0%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%2294a3b8%22 font-size=%2230%22%3EOverseas%20Hero%3C/text%3E%3C/svg%3E'

/** 해외 허브 시즌 히어로 자동 전환 간격 */
const HERO_SEASON_AUTO_MS = 10_000
const HERO_SEASON_MANUAL_COOLDOWN_MS = 10_000

function HeroCurationLink({
  href,
  className,
  ariaLabel,
  children,
}: {
  href: string
  className?: string
  ariaLabel: string
  children: ReactNode
}) {
  const safe = href.trim() || '/travel/overseas'
  if (/^https?:\/\//i.test(safe)) {
    return (
      <a href={safe} className={className} rel="noopener noreferrer" aria-label={ariaLabel}>
        {children}
      </a>
    )
  }
  return (
    <Link href={safe} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  )
}

type CountryBrowseHeroRow = {
  title: string
  primaryDestination: string | null
  duration: string | null
  bgImageUrl: string | null
  coverImageUrl: string | null
}

export type OverseasHeroProps = {
  /** `searchParams.country` — 나라 선택 시 상단 히어로 전환 */
  selectedCountrySlug?: string | null
  /** 지방출발 3종(`busan_dep` 등)만 서버에서 전달 — 일반 권역 탭은 null */
  selectedRegionSlug?: string | null
  /** 해외 허브 히어로 — 시즌 추천 여행지 5도시(서버, `SeasonalDestinationCuration`) */
  seasonDestinationHeroSlides?: OverseasHubDestinationHeroSlide[] | null
}

const OverseasHero: FC<OverseasHeroProps> = ({
  selectedCountrySlug = null,
  selectedRegionSlug = null,
  seasonDestinationHeroSlides = null,
}) => {
  const router = useRouter()
  const searchParams = useSearchParams() ?? new URLSearchParams()
  const departDateId = 'overseas-hero-depart-date'
  const calendarTitleId = useId()
  const calendarPanelId = useId()
  const publicMinYmd = useMemo(() => getPublicBookableMinYmd(), [])
  const sanitizeDepartDate = (raw: string | null): string => {
    const v = (raw ?? '').trim()
    if (!v) return ''
    return v >= publicMinYmd ? v : ''
  }
  const dateWrapRef = useRef<HTMLDivElement>(null)
  const [departDate, setDepartDate] = useState(sanitizeDepartDate(searchParams.get('departDate')))
  const [adultCount, setAdultCount] = useState(searchParams.get('adult') ?? '1')
  const [childCount, setChildCount] = useState(searchParams.get('child') ?? '0')
  const [idx, setIdx] = useState(0)
  const [broken, setBroken] = useState<Record<string, boolean>>({})
  const [isPaused, setIsPaused] = useState(false)
  const [lastManualAt, setLastManualAt] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)
  const heroSlideCountRef = useRef(0)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [countryBrowseData, setCountryBrowseData] = useState<{
    total: number
    items: CountryBrowseHeroRow[]
  } | null>(null)
  const [countryBrowseLoading, setCountryBrowseLoading] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => {
    const fromUrl = parseYmd(sanitizeDepartDate(searchParams.get('departDate')))
    const d = fromUrl ?? new Date()
    return { y: d.getFullYear(), m: d.getMonth() + 1 }
  })

  const hubPath = '/travel/overseas'

  const countrySlug = useMemo(() => {
    const fromProps = (selectedCountrySlug ?? '').trim()
    if (fromProps) return fromProps
    return (searchParams.get('country') ?? '').trim() || null
  }, [selectedCountrySlug, searchParams])

  const normalizedSelectedRegionSlug = (selectedRegionSlug ?? '').trim()

  const localDepLabel =
    normalizedSelectedRegionSlug === 'busan_dep'
      ? '부산'
      : normalizedSelectedRegionSlug === 'cheongju_dep'
        ? '청주'
        : normalizedSelectedRegionSlug === 'daegu_dep'
          ? '대구'
          : null
  const isLocalDepartureMode = Boolean(localDepLabel)
  const isSpotlightMode = Boolean(countrySlug) || isLocalDepartureMode

  const seasonSlides = useMemo(
    () =>
      (seasonDestinationHeroSlides ?? []).filter(
        (s) => s.headline.trim() || (s.imageUrl ?? '').trim(),
      ),
    [seasonDestinationHeroSlides],
  )

  const matchedCountrySlide = useMemo(
    () => (countrySlug ? findSeasonDestinationSlideForBrowseCountry(seasonDestinationHeroSlides, countrySlug) : null),
    [countrySlug, seasonDestinationHeroSlides],
  )

  const countryHeroDisplayName = useMemo(
    () => (countrySlug ? countryDisplayNameFromBrowseParam(countrySlug) : ''),
    [countrySlug],
  )

  const autoHeroFromBrowse = useMemo((): {
    imageUrl: string | null
    title: string
    subtitle: string
  } | null => {
    if (matchedCountrySlide || !countryBrowseData?.items?.length) return null
    const items = countryBrowseData.items
    let pick = items[0]!
    let img: string | null = null
    for (const it of items) {
      const u = (it.bgImageUrl ?? '').trim() || (it.coverImageUrl ?? '').trim()
      if (u) {
        pick = it
        img = u
        break
      }
    }
    const dest = (pick.primaryDestination ?? '').trim()
    const dur = (pick.duration ?? '').trim()
    const subtitle = [dest, dur].filter(Boolean).join(' · ')
    return { imageUrl: img, title: pick.title, subtitle }
  }, [matchedCountrySlide, countryBrowseData])

  const spotlightBrowseFooterLine = useMemo(() => {
    const t = countryBrowseData?.total ?? 0
    const n = t.toLocaleString('ko-KR')
    if (countrySlug) return `${countryHeroDisplayName} 여행상품 ${n}개`
    if (localDepLabel) return `${localDepLabel}출발 여행상품 ${n}개`
    return ''
  }, [countryBrowseData?.total, countryHeroDisplayName, countrySlug, localDepLabel])

  useEffect(() => {
    if (!isSpotlightMode) {
      setCountryBrowseData(null)
      setCountryBrowseLoading(false)
      return
    }
    let cancelled = false
    setCountryBrowseLoading(true)
    ;(async () => {
      try {
        const p = new URLSearchParams({
          scope: 'overseas',
          limit: '30',
          sort: 'popular',
        })
        if (countrySlug) {
          p.set('country', countrySlug)
          const r = (searchParams.get('region') ?? '').trim()
          if (r) p.set('region', r)
        } else if (normalizedSelectedRegionSlug) {
          p.set('region', normalizedSelectedRegionSlug)
        }
        const res = await fetch(`/api/products/browse?${p.toString()}`)
        const json = (await res.json()) as {
          ok?: boolean
          total?: number
          items?: CountryBrowseHeroRow[]
        }
        if (cancelled) return
        if (res.ok && json?.ok === true && typeof json.total === 'number') {
          const raw = Array.isArray(json.items) ? json.items : []
          const items: CountryBrowseHeroRow[] = raw.map((row) => ({
            title: typeof row?.title === 'string' ? row.title : '',
            primaryDestination: typeof row?.primaryDestination === 'string' ? row.primaryDestination : null,
            duration: typeof row?.duration === 'string' ? row.duration : null,
            bgImageUrl: typeof row?.bgImageUrl === 'string' ? row.bgImageUrl : null,
            coverImageUrl: typeof row?.coverImageUrl === 'string' ? row.coverImageUrl : null,
          }))
          setCountryBrowseData({ total: json.total, items })
        } else {
          setCountryBrowseData({ total: 0, items: [] })
        }
      } catch {
        if (!cancelled) setCountryBrowseData(null)
      } finally {
        if (!cancelled) setCountryBrowseLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [countrySlug, isSpotlightMode, searchParams, selectedRegionSlug])

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

  const mergeDepartPax = useCallback(
    (p: URLSearchParams, next: { departDate: string; adult: string; child: string }) => {
      if (next.departDate.trim()) {
        p.set('departDate', next.departDate.trim())
        p.set('departMonth', next.departDate.slice(0, 7))
      } else {
        p.delete('departDate')
        p.delete('departMonth')
      }
      const adultNum = Math.max(1, Number.parseInt(next.adult || '1', 10) || 1)
      const childNum = Math.max(0, Number.parseInt(next.child || '0', 10) || 0)
      p.set('adult', String(adultNum))
      p.set('child', String(childNum))
      p.set('pax', String(adultNum + childNum))
    },
    [],
  )

  const applySearch = (next: { departDate: string; adult: string; child: string }) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('scope', 'overseas')
    p.delete('page')
    mergeDepartPax(p, next)
    p.delete('listingKind')
    p.delete('type')
    router.replace(`${hubPath}?${p.toString()}`)
  }

  const applyDestination = useCallback(
    (item: OverseasLocationSuggestion | null) => {
      const p = new URLSearchParams(searchParams.toString())
      p.set('scope', 'overseas')
      p.delete('page')
      mergeDepartPax(p, { departDate, adult: adultCount, child: childCount })
      if (!item) {
        p.delete('region')
        p.delete('country')
        p.delete('city')
        p.delete('menuGroup')
        p.delete('destination')
      } else {
        const parsed = new URL(item.href, 'https://bongtour.local')
        for (const key of ['region', 'country', 'city', 'menuGroup'] as const) {
          const v = parsed.searchParams.get(key)
          if (v) p.set(key, v)
          else p.delete(key)
        }
        p.delete('destination')
      }
      router.replace(`${hubPath}?${p.toString()}`)
    },
    [searchParams, router, departDate, adultCount, childCount, mergeDepartPax],
  )

  const destinationLabel = useMemo(
    () =>
      overseasBrowseLabelFromParams(
        countrySlug,
        (searchParams.get('city') ?? '').trim() || null,
      ),
    [countrySlug, searchParams],
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduceMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    setIdx((prev) => {
      const n = seasonSlides.length
      if (n <= 0) return 0
      return prev % n
    })
  }, [seasonSlides.length])

  const current = seasonSlides[idx % Math.max(seasonSlides.length, 1)] ?? null

  const shiftSeasonSlide = (delta: number) => {
    setLastManualAt(Date.now())
    setIdx((v) => {
      const n = seasonSlides.length
      if (n <= 1) return v
      return (v + delta + n) % n
    })
  }

  useEffect(() => {
    heroSlideCountRef.current = seasonSlides.length
    if (seasonSlides.length <= 1 || isPaused || reduceMotion) return
    const t = setInterval(() => {
      if (Date.now() - lastManualAt < HERO_SEASON_MANUAL_COOLDOWN_MS) return
      setIdx((v) => {
        const n = heroSlideCountRef.current
        if (n <= 1) return v
        return (v + 1) % n
      })
    }, HERO_SEASON_AUTO_MS)
    return () => clearInterval(t)
  }, [seasonSlides.length, isPaused, reduceMotion, lastManualAt])

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

  const clearDepartDate = () => {
    setDepartDate('')
    applySearch({ departDate: '', adult: adultCount, child: childCount })
    setCalendarOpen(true)
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
      <div className="relative flex w-full min-w-0 items-stretch gap-1">
        <button
          type="button"
          id={departDateId}
          aria-haspopup="dialog"
          aria-expanded={calendarOpen}
          aria-controls={calendarPanelId}
          aria-label={departDate ? `출발일 ${formatDepartBarLabel(departDate)}, 다시 선택` : '출발일 선택'}
          onClick={() => setCalendarOpen(true)}
          className={`relative flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-bt-ui-accent/25 ${
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
        {departDate ? (
          <button
            type="button"
            onClick={clearDepartDate}
            className="shrink-0 rounded-lg border border-bt-border px-2.5 text-xs text-bt-muted hover:border-bt-accent/35 hover:text-bt-ink"
            aria-label="출발일 지우기"
          >
            ✕
          </button>
        ) : null}
      </div>

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

  const heroSearchForm = (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        applySearch({ departDate, adult: adultCount, child: childCount })
      }}
      className="rounded-2xl border border-bt-border bg-white p-4 shadow-lg sm:p-5"
      role="search"
      aria-label="목적지와 출발일로 해외여행 검색"
    >
      <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
        <OverseasDestinationAutocomplete
          valueLabel={destinationLabel}
          onSelect={(item) => applyDestination(item)}
          onClear={() => applyDestination(null)}
          label="어디로"
          showMenuHint={false}
          placeholder="나라·도시 (예: 다낭, 도쿄)"
          inputClassName="w-full rounded-lg border border-bt-border bg-white px-3 py-2.5 pr-9 text-sm text-bt-ink outline-none placeholder:text-bt-subtle focus:border-bt-ui-accent focus:ring-2 focus:ring-bt-ui-accent/25"
        />
        <div className="min-w-0">
          <label htmlFor={departDateId} className="text-sm font-medium text-bt-ink">
            언제
          </label>
          <div className="mt-1.5">{dateField}</div>
        </div>
      </div>
    </form>
  )

  return (
    <section className="relative border-b border-bt-border">
      <div
        className={`relative w-full overflow-hidden pb-[5.5rem] sm:pb-[6rem] lg:pb-0 ${
          isSpotlightMode
            ? 'min-h-[min(260px,44vh)] sm:min-h-[min(300px,48vh)]'
            : 'min-h-[min(280px,46vh)] sm:min-h-[min(340px,50vh)]'
        }`}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        aria-live={reduceMotion ? 'polite' : 'off'}
      >
        <div className="absolute inset-0">
            {isSpotlightMode ? (
              matchedCountrySlide ? (
                <OverseasCountryHeroBanner
                  imageUrl={matchedCountrySlide.imageUrl}
                  title={matchedCountrySlide.headline}
                  subtitle={matchedCountrySlide.subline}
                  footerLine={
                    countryBrowseData != null
                      ? `${countryHeroDisplayName} 여행상품 ${countryBrowseData.total.toLocaleString('ko-KR')}개`
                      : `${countryHeroDisplayName} 여행상품`
                  }
                  showCta
                  ctaHref={matchedCountrySlide.href}
                />
              ) : countryBrowseLoading ? (
                <div className="h-[240px] w-full animate-pulse rounded-xl bg-slate-200/70 lg:h-[300px]" />
              ) : autoHeroFromBrowse ? (
                <OverseasCountryHeroBanner
                  imageUrl={autoHeroFromBrowse.imageUrl}
                  title={autoHeroFromBrowse.title}
                  subtitle={autoHeroFromBrowse.subtitle}
                  footerLine={spotlightBrowseFooterLine}
                  showCta={false}
                  ctaHref=""
                />
              ) : isLocalDepartureMode && !countrySlug && !countryBrowseLoading ? (
                <OverseasCountryHeroBanner
                  imageUrl={null}
                  title={`${localDepLabel}출발 등록 상품 준비 중`}
                  subtitle=""
                  footerLine={`${localDepLabel}출발 여행상품 ${(countryBrowseData?.total ?? 0).toLocaleString('ko-KR')}개`}
                  showCta={false}
                  ctaHref=""
                />
              ) : countrySlug ? (
                <OverseasCountryHeroBanner
                  imageUrl={null}
                  title={`${countryHeroDisplayName} 여행상품`}
                  subtitle=""
                  footerLine={`${countryHeroDisplayName} 여행상품 ${(countryBrowseData?.total ?? 0).toLocaleString('ko-KR')}개`}
                  showCta={false}
                  ctaHref=""
                />
              ) : null
            ) : !current ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-sm text-bt-subtle">
                <p>다가오는 3개월 추천 여행지를 준비 중입니다.</p>
                <p className="text-xs">잠시 후 다시 확인해 주세요.</p>
              </div>
            ) : (
              (() => {
                const src = broken[current.id] ? HERO_FALLBACK : current.imageUrl ?? HERO_FALLBACK
                const dots =
                  seasonSlides.length > 1 ? (
                    seasonSlides.length <= 16 ? (
                      <div className="pointer-events-none absolute right-2 top-2 z-20 flex max-w-[min(100%,20rem)] flex-wrap items-center justify-end gap-1.5">
                        {seasonSlides.map((_, i) => (
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
                              i === idx % seasonSlides.length ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
                            }`}
                            aria-label={`추천 슬라이드 ${i + 1}${i === idx % seasonSlides.length ? ' (현재)' : ''}`}
                            aria-current={i === idx % seasonSlides.length ? 'true' : undefined}
                            aria-pressed={i === idx % seasonSlides.length}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="pointer-events-none absolute right-2 top-2 z-20 rounded-md bg-black/50 px-2 py-1 text-[11px] font-medium tabular-nums text-white/95">
                        {(idx % seasonSlides.length) + 1} / {seasonSlides.length}
                      </div>
                    )
                  ) : null
                const inner = (
                  <>
                    <SafeImage
                      src={src}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="100vw"
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      priority={idx === 0}
                      decoding="async"
                      onError={() => setBroken((prev) => ({ ...prev, [current.id]: true }))}
                    />
                    {dots}
                  </>
                )
                return (
                  <div className="relative h-full w-full">
                    {seasonSlides.length > 1 ? (
                      <>
                        <button
                          type="button"
                          className="absolute left-2 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/45 text-2xl font-light text-white shadow-lg backdrop-blur-sm transition hover:bg-black/60 sm:left-4"
                          aria-label="이전 추천 여행지"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            shiftSeasonSlide(-1)
                          }}
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/45 text-2xl font-light text-white shadow-lg backdrop-blur-sm transition hover:bg-black/60 sm:right-4"
                          aria-label="다음 추천 여행지"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            shiftSeasonSlide(1)
                          }}
                        >
                          ›
                        </button>
                      </>
                    ) : null}
                    <HeroCurationLink
                      href={current.href}
                      className="group relative block h-full w-full"
                      ariaLabel={`${current.headline} 자세히 보기`}
                    >
                      {inner}
                    </HeroCurationLink>
                  </div>
                )
              })()
            )}
          {!isSpotlightMode && current ? (
            <div
              className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/75 via-black/25 to-transparent"
              aria-hidden
            />
          ) : null}
          {isSpotlightMode ? (
            <div
              className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/50 via-transparent to-transparent"
              aria-hidden
            />
          ) : null}
        </div>

        {!isSpotlightMode && current ? (
          <div className="absolute inset-x-0 top-0 z-10 px-4 pt-3 sm:px-6 sm:pt-4">
            <div className="mx-auto max-w-6xl">
              <p className="text-lg font-bold leading-snug text-white drop-shadow-md sm:text-xl">{current.headline}</p>
              {current.subline ? (
                <p className="mt-1 line-clamp-2 text-sm text-white/95 drop-shadow">{current.subline}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-32 bg-gradient-to-t from-black/50 via-black/15 to-transparent sm:h-36 lg:hidden" aria-hidden />

        <div className="absolute inset-x-0 bottom-0 z-20 mx-auto w-full max-w-6xl px-4 pb-3 sm:px-6 sm:pb-4 lg:hidden">
          {heroSearchForm}
        </div>
      </div>
    </section>
  )
}

export default OverseasHero
