'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import RecentSeriesSection from '@/components/admin/marketing/trip-recommendations/RecentSeriesSection'

interface TripRecommendationItem {
  city: string
  country: string
  season: 'spring' | 'summer' | 'autumn' | 'winter'
  monthRange: string
  urgency: string
  reason: string
  recommendedTripNights: number
  recommendedTripDays: number
  themes?: string[]
  matchingProductIds: string[]
  events?: string[]
}

interface TripRecommendation {
  generatedAt: string
  windowMonths: number
  recommendations: TripRecommendationItem[]
  totalProductsAnalyzed: number
}

const STORAGE_KEY = 'bong-trip-recommendations'
const STORAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000

const SEASON_LABELS: Record<string, string> = {
  spring: '봄',
  summer: '여름',
  autumn: '가을',
  winter: '겨울',
}

const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'] as const

export default function TripRecommendationsClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [refreshingEvents, setRefreshingEvents] = useState(false)
  const [data, setData] = useState<TripRecommendation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [eventsMsg, setEventsMsg] = useState<string | null>(null)

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
      if (stored.recommendations?.length) {
        setData(stored)
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const grouped = useMemo(() => {
    if (!data?.recommendations.length) return null
    const acc: Record<string, TripRecommendationItem[]> = {}
    for (const r of data.recommendations) {
      if (!acc[r.season]) acc[r.season] = []
      acc[r.season].push(r)
    }
    return acc
  }, [data])

  function persistRecommendations(next: TripRecommendation) {
    setData(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function handleClear() {
    localStorage.removeItem(STORAGE_KEY)
    setData(null)
    setError(null)
  }

  async function handleGenerate() {
    setLoading(true)
    setError(null)
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
    setEventsMsg(null)
    try {
      const res = await fetch('/api/admin/marketing/seasonal-events/refresh', { method: 'POST' })
      const json = (await res.json()) as { count?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? '이벤트 갱신 실패')
      setEventsMsg(`이벤트 ${json.count ?? 0}개 갱신됨. 다음 [추천 받기]부터 반영됩니다.`)
    } catch (err) {
      setEventsMsg(err instanceof Error ? err.message : '이벤트 갱신 실패')
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
          className="rounded-lg border border-bt-border-strong px-3 py-2 text-xs text-bt-body hover:bg-bt-surface-soft disabled:opacity-50"
        >
          {refreshingEvents ? '이벤트 갱신 중…' : '이벤트 갱신'}
        </button>
        {data && (
          <p className="text-sm text-bt-body/60">
            {new Date(data.generatedAt).toLocaleString('ko-KR')}에 받은 추천입니다.
            <button type="button" onClick={handleClear} className="ml-2 text-bt-link hover:underline">
              초기화
            </button>
          </p>
        )}
        {data && !grouped && (
          <span className="text-sm text-bt-body/70">분석 상품: {data.totalProductsAnalyzed}개</span>
        )}
      </div>

      {eventsMsg && (
        <p className="text-sm text-bt-body/70">{eventsMsg}</p>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {grouped && (
        <div className="space-y-8">
          {SEASON_ORDER.map((season) => {
            const items = grouped[season]
            if (!items?.length) return null
            return (
              <section key={season}>
                <h2 className="mb-4 text-lg font-semibold text-bt-title">{SEASON_LABELS[season]}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item, idx) => (
                    <TripCard
                      key={`${season}-${idx}`}
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
    season: item.season,
    monthRange: item.monthRange,
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
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-bt-surface-soft px-2 py-0.5 text-xs text-bt-body">
            {item.recommendedTripNights}박 {item.recommendedTripDays}일
          </span>
          {item.monthRange && (
            <span className="rounded-full bg-bt-surface-soft px-2 py-0.5 text-xs text-bt-body">{item.monthRange}</span>
          )}
          {item.urgency && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900">{item.urgency}</span>
          )}
        </div>
        {item.events && item.events.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.events.map((event) => (
              <span key={event} className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
                {event}
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
