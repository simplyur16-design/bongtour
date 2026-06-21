'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import RecentSeriesSection from '@/components/admin/marketing/trip-recommendations/RecentSeriesSection'
import {
  monthToSeason,
  parseMonthNumber,
  rollingMonthsFrom,
} from '@/lib/bong-marketing/trip-recommender-month-utils'

interface TripRecommendationEvent {
  name: string
  type: 'global-festival'
  city?: string
  appealReason?: string
}

interface TripRecommendationItem {
  month: number
  monthLabel: string
  city: string
  country: string
  urgency: string
  reason: string
  recommendedTripNights: number
  recommendedTripDays: number
  themes?: string[]
  matchingProductIds: string[]
  events?: TripRecommendationEvent[]
  source?: 'climate' | 'event'
  /** 레거시 캐시 호환 */
  season?: 'spring' | 'summer' | 'autumn' | 'winter'
  monthRange?: string
}

interface TripRecommendation {
  generatedAt: string
  windowMonths: number
  startMonth?: number
  recommendations: TripRecommendationItem[]
  totalProductsAnalyzed: number
}

const STORAGE_KEY = 'bong-trip-recommendations'
const STORAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000

type EventRefreshTargetMode = 'union' | 'recommendation' | 'curation' | 'all_products'

const EVENT_REFRESH_MODE_OPTIONS: { value: EventRefreshTargetMode; label: string }[] = [
  { value: 'union', label: '전체 합집합 (권장)' },
  { value: 'recommendation', label: '추천 국가만' },
  { value: 'curation', label: '본체 큐레이션 국가' },
  { value: 'all_products', label: '전체 상품 국가' },
]

function extractRecommendationCountries(stored: TripRecommendation | null): string[] {
  if (!stored?.recommendations.length) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of stored.recommendations) {
    const country = item.country?.trim()
    if (!country) continue
    const key = country.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(country)
  }
  return out
}

function legacyMonthFromSeason(season?: string): number | null {
  const map: Record<string, number> = { spring: 4, summer: 7, autumn: 10, winter: 1 }
  return season && map[season] ? map[season] : null
}

function normalizeStoredItem(item: TripRecommendationItem): TripRecommendationItem | null {
  const month =
    item.month ??
    parseMonthNumber(item.monthLabel) ??
    parseMonthNumber(item.monthRange) ??
    legacyMonthFromSeason(item.season) ??
    null
  if (!month) return null
  const monthLabel = item.monthLabel?.trim() || `${month}월`
  return {
    ...item,
    month,
    monthLabel,
    season: item.season ?? monthToSeason(month),
    monthRange: monthLabel,
  }
}

function normalizeStoredRecommendation(stored: TripRecommendation): TripRecommendation | null {
  const recommendations = (stored.recommendations ?? [])
    .map(normalizeStoredItem)
    .filter((r): r is TripRecommendationItem => r !== null)
  if (!recommendations.length) return null
  const now = new Date()
  const startMonth = stored.startMonth ?? now.getMonth() + 1
  return {
    ...stored,
    startMonth,
    windowMonths: stored.windowMonths ?? 12,
    recommendations,
  }
}

export default function TripRecommendationsClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [refreshingEvents, setRefreshingEvents] = useState(false)
  const [data, setData] = useState<TripRecommendation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resetNotice, setResetNotice] = useState<string | null>(null)
  const [eventRefreshResult, setEventRefreshResult] = useState<{
    countries?: string[]
    collected?: number
    saved?: number
    skippedDuplicates?: number
    batchesRun?: number
    errors?: number
    targetMode?: string
    usedProductFallback?: boolean
    errorDetails?: Array<{ stage: string; message: string; country?: string }>
    rawResponseSamples?: string[]
    error?: string
  } | null>(null)
  const [eventRefreshTargetMode, setEventRefreshTargetMode] =
    useState<EventRefreshTargetMode>('union')
  const [skipRecentCollection, setSkipRecentCollection] = useState(false)
  const [prioritizeRecommendationCities, setPrioritizeRecommendationCities] = useState(false)
  const [targetPreview, setTargetPreview] = useState<{
    count: number
    countries: string[]
    usedProductFallback?: boolean
  } | null>(null)
  const [targetPreviewLoading, setTargetPreviewLoading] = useState(false)

  const recommendationCountries = useMemo(() => extractRecommendationCountries(data), [data])

  useEffect(() => {
    if (eventRefreshTargetMode === 'all_products') {
      setTargetPreview(null)
      return
    }

    let cancelled = false
    const run = async () => {
      setTargetPreviewLoading(true)
      try {
        const q = new URLSearchParams({ targetMode: eventRefreshTargetMode })
        if (
          (eventRefreshTargetMode === 'union' || eventRefreshTargetMode === 'recommendation') &&
          recommendationCountries.length
        ) {
          q.set('targetCountries', recommendationCountries.join(','))
        }
        const res = await fetch(`/api/admin/marketing/global-events/target-countries?${q}`)
        const json = (await res.json()) as {
          count?: number
          countries?: string[]
          usedProductFallback?: boolean
          error?: string
        }
        if (cancelled) return
        if (!res.ok) {
          setTargetPreview(null)
          return
        }
        setTargetPreview({
          count: json.count ?? json.countries?.length ?? 0,
          countries: json.countries ?? [],
          usedProductFallback: json.usedProductFallback,
        })
      } catch {
        if (!cancelled) setTargetPreview(null)
      } finally {
        if (!cancelled) setTargetPreviewLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [eventRefreshTargetMode, recommendationCountries])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const stored = JSON.parse(raw) as TripRecommendation
      const generatedAt = new Date(stored.generatedAt).getTime()
      if (Number.isNaN(generatedAt) || Date.now() - generatedAt > STORAGE_TTL_MS) {
        localStorage.removeItem(STORAGE_KEY)
        return
      }
      const normalized = normalizeStoredRecommendation(stored)
      if (normalized) {
        setData(normalized)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const monthOrder = useMemo(() => {
    if (!data) return []
    const start = data.startMonth ?? new Date().getMonth() + 1
    return rollingMonthsFrom(start, 12)
  }, [data])

  const grouped = useMemo(() => {
    if (!data?.recommendations.length) return null
    const acc: Record<number, TripRecommendationItem[]> = {}
    for (const r of data.recommendations) {
      if (!acc[r.month]) acc[r.month] = []
      acc[r.month].push(r)
    }
    return acc
  }, [data])

  function persistRecommendations(next: TripRecommendation) {
    setData(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function clearRecommendationsCache() {
    localStorage.removeItem(STORAGE_KEY)
    setData(null)
    setError(null)
  }

  function handleReset() {
    clearRecommendationsCache()
    setEventRefreshResult(null)
    setResetNotice('캐시 초기화됨')
    window.setTimeout(() => setResetNotice(null), 3000)
  }

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setResetNotice(null)
    clearRecommendationsCache()
    try {
      const res = await fetch('/api/admin/marketing/trip-recommendations', { method: 'POST' })
      const json = (await res.json()) as TripRecommendation & { error?: string }
      if (!res.ok) throw new Error(json.error ?? '추천 생성 실패')
      persistRecommendations(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류')
    } finally {
      setLoading(false)
    }
  }

  async function handleRefreshEvents() {
    setRefreshingEvents(true)
    setEventRefreshResult(null)

    if (eventRefreshTargetMode === 'recommendation' && !recommendationCountries.length) {
      setEventRefreshResult({
        error: '추천 국가가 없습니다. 먼저 [추천 받기]를 실행해 주세요.',
      })
      setRefreshingEvents(false)
      return
    }

    try {
      const payload: {
        targetMode: EventRefreshTargetMode
        targetCountries?: string[]
        skipRecent?: boolean
        recentDays?: number
        prioritizeRecommendationCities?: boolean
      } = {
        targetMode: eventRefreshTargetMode,
      }
      if (
        (eventRefreshTargetMode === 'recommendation' || eventRefreshTargetMode === 'union') &&
        recommendationCountries.length
      ) {
        payload.targetCountries = recommendationCountries
      }
      if (skipRecentCollection) {
        payload.skipRecent = true
        payload.recentDays = 30
      }
      if (prioritizeRecommendationCities) {
        payload.prioritizeRecommendationCities = true
      }

      const res = await fetch('/api/admin/marketing/global-events/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as {
        countries?: string[]
        collected?: number
        saved?: number
        skippedDuplicates?: number
        batchesRun?: number
        errors?: number
        targetMode?: string
        usedProductFallback?: boolean
        errorDetails?: Array<{ stage: string; message: string; country?: string }>
        rawResponseSamples?: string[]
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? '이벤트 갱신 실패')
      if (
        json.errorDetails?.some((e) => e.stage === 'no_countries') &&
        !json.countries?.length &&
        (json.collected ?? 0) === 0
      ) {
        setEventRefreshResult({
          error: json.errorDetails?.[0]?.message ?? '갱신 대상 국가가 없습니다.',
        })
        return
      }
      setEventRefreshResult(json)
    } catch (err) {
      setEventRefreshResult({
        error: err instanceof Error ? err.message : '이벤트 갱신 실패',
      })
    } finally {
      setRefreshingEvents(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={loading}
          className="rounded-lg bg-bt-brand-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? '추천 생성 중… (1-2분 소요)' : data ? '[재추천]' : '[추천 받기]'}
        </button>
        <button
          type="button"
          onClick={() => void handleRefreshEvents()}
          disabled={refreshingEvents || loading}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {refreshingEvents ? '갱신 중…' : '전체 이벤트 갱신'}
        </button>
        <label className="flex flex-col gap-1 text-xs text-bt-body/70">
          갱신 대상
          <select
            value={eventRefreshTargetMode}
            onChange={(e) => setEventRefreshTargetMode(e.target.value as EventRefreshTargetMode)}
            disabled={refreshingEvents || loading}
            className="min-w-[11rem] rounded-lg border border-bt-border-strong bg-white px-3 py-2 text-sm text-bt-body"
          >
            {EVENT_REFRESH_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-bt-body/80">
          <input
            type="checkbox"
            checked={skipRecentCollection}
            onChange={(e) => setSkipRecentCollection(e.target.checked)}
            disabled={refreshingEvents || loading}
            className="rounded border-bt-border-strong"
          />
          최근 30일 갱신 스킵
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-bt-body/80">
          <input
            type="checkbox"
            checked={prioritizeRecommendationCities}
            onChange={(e) => setPrioritizeRecommendationCities(e.target.checked)}
            disabled={refreshingEvents || loading}
            className="rounded border-bt-border-strong"
          />
          추천 도시(국가) 우선
        </label>
        <button
          type="button"
          onClick={handleReset}
          disabled={loading || refreshingEvents}
          className="rounded-lg border border-bt-border-strong px-4 py-2 text-sm font-medium text-bt-body hover:bg-bt-surface-soft disabled:opacity-50"
        >
          초기화
        </button>
        {data && (
          <p className="text-sm text-bt-body/60">
            {new Date(data.generatedAt).toLocaleString('ko-KR')}에 받은 추천입니다.
          </p>
        )}
        {data && !grouped && (
          <span className="text-sm text-bt-body/70">분석 상품: {data.totalProductsAnalyzed}개</span>
        )}
      </div>

      {eventRefreshTargetMode === 'recommendation' && !recommendationCountries.length && (
        <p className="text-sm text-amber-800">
          「추천 국가만」은 [추천 받기] 결과가 필요합니다. 먼저 추천을 생성해 주세요.
        </p>
      )}
      {targetPreviewLoading && eventRefreshTargetMode !== 'all_products' ? (
        <p className="text-sm text-bt-body/60">갱신 대상 국가 미리보기 불러오는 중…</p>
      ) : null}
      {targetPreview && eventRefreshTargetMode !== 'all_products' ? (
        <p className="text-sm text-bt-body/70">
          갱신 대상 <strong className="font-medium">{targetPreview.count}개국</strong>
          {targetPreview.countries.length > 0
            ? `: ${targetPreview.countries.slice(0, 8).join(', ')}${targetPreview.countries.length > 8 ? '…' : ''}`
            : ''}
          {targetPreview.usedProductFallback
            ? ' (큐레이션 국가 없음 → 상품 국가로 대체)'
            : ''}
        </p>
      ) : null}

      {resetNotice && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          {resetNotice}
        </div>
      )}

      {eventRefreshResult && (
        <div
          className={`mt-2 rounded p-3 text-sm ${
            eventRefreshResult.error ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'
          }`}
        >
          {eventRefreshResult.error ? (
            eventRefreshResult.error
          ) : (
            <div className="space-y-2">
              <p>
                {eventRefreshResult.targetMode ? `[${eventRefreshResult.targetMode}] ` : ''}
                {eventRefreshResult.countries?.length ?? 0}개 국가 · {eventRefreshResult.batchesRun ?? 0}배치 ·{' '}
                {eventRefreshResult.collected ?? 0}개 수집 · {eventRefreshResult.saved ?? 0}개 신규 ·{' '}
                {eventRefreshResult.skippedDuplicates ?? 0}개 업데이트
                {(eventRefreshResult.errors ?? 0) > 0 ? ` · 오류 ${eventRefreshResult.errors}건` : ''}
                {eventRefreshResult.usedProductFallback ? ' · 상품 국가 fallback' : ''}
              </p>
              {eventRefreshResult.errorDetails && eventRefreshResult.errorDetails.length > 0 && (
                <ul className="list-disc space-y-1 pl-4 text-xs">
                  {eventRefreshResult.errorDetails.slice(0, 5).map((err, idx) => (
                    <li key={`${err.stage}-${idx}`}>
                      [{err.stage}] {err.country ? `${err.country}: ` : ''}
                      {err.message}
                    </li>
                  ))}
                </ul>
              )}
              {eventRefreshResult.collected === 0 && (
                <p className="text-xs">
                  수집 0건 — GEMINI_API_KEY·모델 한도·배치 오류를 확인하세요. [추천 받기] 전에 재시도하세요.
                </p>
              )}
              {(eventRefreshResult.saved ?? 0) > 0 && (
                <p className="text-xs">
                  신규 {eventRefreshResult.saved}개 이벤트가 수집되었습니다 (검토 대기 상태).{' '}
                  <a
                    href="/admin/marketing/curation-events?status=draft"
                    className="font-medium text-amber-950 underline hover:no-underline"
                  >
                    /admin/marketing/curation-events
                  </a>
                  에서 검토 후 approve 하면 🌐 태그에 반영됩니다.
                </p>
              )}
              {(eventRefreshResult.collected ?? 0) > 0 && (eventRefreshResult.saved ?? 0) === 0 && (
                <p className="text-xs">
                  기존 이벤트 {eventRefreshResult.collected}건이 갱신되었습니다. 신규 건은 검토 페이지에서
                  확인하세요.
                </p>
              )}
              {(eventRefreshResult.collected ?? 0) > 0 && (
                <p className="text-xs text-bt-body/80">
                  approve 완료 후 [추천 받기]를 다시 실행하면 승인된 이벤트가 🌐 태그로 표시됩니다.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {grouped && (
        <div className="space-y-8">
          {monthOrder.map((month) => {
            const items = grouped[month]
            if (!items?.length) return null
            return (
              <section key={month}>
                <h2 className="mb-4 text-lg font-semibold text-bt-title">{month}월</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item, idx) => (
                    <TripCard
                      key={`${month}-${idx}`}
                      item={item}
                      onCreated={(redirectTo) => router.push(redirectTo)}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <RecentSeriesSection />
    </div>
  )
}

function TripCard({
  item,
  onCreated,
}: {
  item: TripRecommendationItem
  onCreated: (redirectTo: string) => void
}) {
  const [creatingCardNews, setCreatingCardNews] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showBlogTrackModal, setShowBlogTrackModal] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState<'package' | 'airtel'>('package')
  const [creatingBlog, setCreatingBlog] = useState(false)
  const [blogError, setBlogError] = useState<string | null>(null)

  const recommendationPayload = {
    city: item.city,
    country: item.country,
    month: item.month,
    monthLabel: item.monthLabel,
    season: item.season ?? monthToSeason(item.month),
    monthRange: item.monthLabel,
    urgency: item.urgency,
    reason: item.reason,
    recommendedTripNights: item.recommendedTripNights,
    recommendedTripDays: item.recommendedTripDays,
    matchingProductIds: item.matchingProductIds,
    themes: item.themes,
  }

  async function handleCreateCardNews() {
    setCreatingCardNews(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/admin/marketing/card-news/series/from-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recommendationPayload),
      })
      const json = (await res.json()) as { redirectTo?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? '시리즈 생성 실패')
      if (json.redirectTo) onCreated(json.redirectTo)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '시리즈 생성 실패')
    } finally {
      setCreatingCardNews(false)
    }
  }

  async function handleCreateBlog(track: 'package' | 'airtel') {
    setCreatingBlog(true)
    setBlogError(null)
    try {
      const res = await fetch('/api/admin/marketing/blog/from-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...recommendationPayload, contentTrack: track }),
      })
      const json = (await res.json()) as { redirectTo?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? '블로그 글 생성 실패')
      if (json.redirectTo) {
        setShowBlogTrackModal(false)
        onCreated(json.redirectTo)
      }
    } catch (err) {
      setBlogError(err instanceof Error ? err.message : '블로그 글 생성 실패')
    } finally {
      setCreatingBlog(false)
    }
  }

  return (
    <>
      <div className="rounded-xl border border-bt-border-strong bg-white p-4 shadow-sm">
        <div className="text-base font-semibold text-bt-title">
          {item.city}
          <span className="font-normal text-bt-body/70"> · {item.country}</span>
          {item.source === 'event' ? (
            <span className="ml-2 rounded bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
              이벤트 슬롯
            </span>
          ) : item.source === 'climate' ? (
            <span className="ml-2 rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
              기후
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-bt-surface-soft px-2 py-0.5 text-xs text-bt-body">
            {item.recommendedTripNights}박 {item.recommendedTripDays}일
          </span>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-900">{item.monthLabel}</span>
          {item.urgency && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900">{item.urgency}</span>
          )}
        </div>
        {item.events && item.events.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.events.map((event, eventIdx) => (
              <span
                key={`${event.name}-${eventIdx}`}
                className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800"
                title={event.appealReason}
              >
                🌐 {event.name}
                {event.city ? ` (${event.city})` : ''}
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 text-sm leading-relaxed text-bt-body/90">{item.reason}</p>
        {item.themes && item.themes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.themes.map((t) => (
              <span key={t} className="text-xs text-bt-brand-blue">
                #{t}
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-bt-body/60">매칭 상품 {item.matchingProductIds.length}개</p>
        {createError && <p className="mt-2 text-xs text-red-700">{createError}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleCreateCardNews()}
            disabled={creatingCardNews || creatingBlog}
            className="rounded-lg border border-bt-border-strong px-3 py-1.5 text-sm hover:bg-bt-surface-soft disabled:opacity-50"
          >
            {creatingCardNews ? '시리즈 생성 중…' : '카드뉴스 만들기'}
          </button>
          <button
            type="button"
            onClick={() => {
              setBlogError(null)
              setShowBlogTrackModal(true)
            }}
            disabled={creatingCardNews || creatingBlog}
            className="rounded-lg border border-bt-border-strong px-3 py-1.5 text-sm hover:bg-bt-surface-soft disabled:opacity-50"
          >
            {creatingBlog ? '블로그 생성 중…' : '블로그 만들기'}
          </button>
        </div>
      </div>

      {showBlogTrackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-bt-title">블로그 글 만들기</h3>
            <p className="mt-1 text-sm text-bt-body/70">
              {item.city} · 어떤 트랙으로 만들까요?
            </p>
            <div className="mt-4 space-y-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-bt-border-strong px-3 py-2 text-sm">
                <input
                  type="radio"
                  name={`blog-track-${item.city}`}
                  checked={selectedTrack === 'package'}
                  onChange={() => setSelectedTrack('package')}
                />
                패키지 여행
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-bt-border-strong px-3 py-2 text-sm">
                <input
                  type="radio"
                  name={`blog-track-${item.city}`}
                  checked={selectedTrack === 'airtel'}
                  onChange={() => setSelectedTrack('airtel')}
                />
                자유여행 (항공+호텔)
              </label>
            </div>
            {blogError && <p className="mt-3 text-sm text-red-700">{blogError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={creatingBlog}
                onClick={() => setShowBlogTrackModal(false)}
                className="rounded-lg border border-bt-border-strong px-3 py-1.5 text-sm hover:bg-bt-surface-soft disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={creatingBlog}
                onClick={() => void handleCreateBlog(selectedTrack)}
                className="rounded-lg bg-bt-brand-blue px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
              >
                {creatingBlog ? '생성 중… (1-2분)' : '생성하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
