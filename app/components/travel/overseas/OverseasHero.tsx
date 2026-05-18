'use client'

import Link from 'next/link'
import SafeImage from '@/app/components/SafeImage'
import { type FC, type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getPublicBookableMinYmd } from '@/lib/public-bookable-date'
import type { HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'
import {
  countryDisplayNameFromBrowseParam,
  findMonthlyCurationForBrowseCountrySlug,
} from '@/lib/overseas-browse-country-hero'
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

type SeasonHeroSlide = {
  id: string
  imageUrl: string | null
  headline: string
  subline: string
  href: string
}

function seasonCurationToHeroSlides(curations: HomeSeasonPickDTO[] | null | undefined): SeasonHeroSlide[] {
  return (curations ?? [])
    .filter((s) => (s.title ?? '').trim() || (s.imageUrl ?? '').trim())
    .map((s) => ({
      id: s.id,
      imageUrl: (s.imageUrl ?? '').trim() || null,
      headline: (s.title ?? '').trim(),
      subline: ((s.subtitle ?? s.excerpt) ?? '').trim(),
      href: (s.ctaHref ?? '/travel/overseas').trim() || '/travel/overseas',
    }))
}

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
  /** 해외 허브 히어로 — 서울 기준 +1·+2월 발행 시즌 큐레이션(서버) */
  seasonCurationSlides?: HomeSeasonPickDTO[] | null
}

const OverseasHero: FC<OverseasHeroProps> = ({
  selectedCountrySlug = null,
  selectedRegionSlug = null,
  seasonCurationSlides = null,
}) => {
  const router = useRouter()
  const searchParams = useSearchParams() ?? new URLSearchParams()
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

  const seasonSlides = useMemo(() => seasonCurationToHeroSlides(seasonCurationSlides), [seasonCurationSlides])

  const matchedCountryCuration = useMemo(
    () => (countrySlug ? findMonthlyCurationForBrowseCountrySlug(seasonCurationSlides, countrySlug) : null),
    [countrySlug, seasonCurationSlides],
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
    if (matchedCountryCuration || !countryBrowseData?.items?.length) return null
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
  }, [matchedCountryCuration, countryBrowseData])

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
        const res = await fetch(`/api/products/browse?${p.toString()}`, { cache: 'no-store' })
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
    p.delete('listingKind')
    p.delete('type')
    router.replace(`${hubPath}?${p.toString()}`)
  }

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

  useEffect(() => {
    heroSlideCountRef.current = seasonSlides.length
    if (seasonSlides.length <= 1 || isPaused || reduceMotion) return
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
    <section className="border-b border-bt-border bg-bt-surface">
      <div
        className={`relative w-full overflow-hidden ${
          isSpotlightMode
            ? 'min-h-[min(320px,52vh)] lg:min-h-[min(380px,56vh)]'
            : 'min-h-[min(440px,62vh)] sm:min-h-[min(480px,65vh)]'
        }`}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        aria-live={reduceMotion ? 'polite' : 'off'}
      >
        <div className="absolute inset-0">
            {isSpotlightMode ? (
              matchedCountryCuration ? (
                <OverseasCountryHeroBanner
                  imageUrl={matchedCountryCuration.imageUrl}
                  title={matchedCountryCuration.title}
                  subtitle={(matchedCountryCuration.subtitle ?? matchedCountryCuration.excerpt ?? '').trim()}
                  footerLine={
                    countryBrowseData != null
                      ? `${countryHeroDisplayName} 여행상품 ${countryBrowseData.total.toLocaleString('ko-KR')}개`
                      : `${countryHeroDisplayName} 여행상품`
                  }
                  showCta
                  ctaHref={matchedCountryCuration.ctaHref}
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
                <p>다음 달·다다음 달 시즌 추천을 준비 중입니다.</p>
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
                  <HeroCurationLink
                    href={current.href}
                    className="group relative block h-full w-full"
                    ariaLabel={`${current.headline} 자세히 보기`}
                  >
                    {inner}
                  </HeroCurationLink>
                )
              })()
            )}
          {!isSpotlightMode && current ? (
            <div
              className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/80 via-black/35 to-transparent"
              aria-hidden
            />
          ) : null}
          {isSpotlightMode ? (
            <div
              className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/55 via-transparent to-transparent"
              aria-hidden
            />
          ) : null}
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-3 px-4 pb-4 pt-16 sm:px-6 sm:pb-6">
          {!isSpotlightMode && current ? (
            <div className="mx-auto w-full max-w-6xl px-0.5">
              <p className="text-base font-bold text-white drop-shadow sm:text-lg">{current.headline}</p>
              {current.subline ? (
                <p className="mt-0.5 line-clamp-2 text-sm text-white/90 drop-shadow">{current.subline}</p>
              ) : null}
            </div>
          ) : null}
          <div className="mx-auto w-full max-w-6xl">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            applySearch({ departDate, adult: adultCount, child: childCount })
          }}
          className="rounded-xl border border-white/25 bg-white/95 p-3 shadow-lg backdrop-blur-sm sm:p-4"
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
        </div>
      </div>
    </section>
  )
}

export default OverseasHero
