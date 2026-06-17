'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CARD_NEWS_SERIES_STATUS_LABEL } from '@/lib/bong-marketing/card-news-admin-constants'

export interface RecentSeriesItem {
  id: string
  themeTitle: string
  selectedCities: string[]
  season: string | null
  seasonLabel: string
  tripNights: number | null
  tripDays: number | null
  status: string
  createdAt: string
  episodeCount: number
}

async function fetchRecentSeries(): Promise<RecentSeriesItem[]> {
  const res = await fetch('/api/admin/marketing/card-news/recent')
  const data = (await res.json()) as { series?: RecentSeriesItem[]; error?: string }
  if (!res.ok) throw new Error(data.error ?? '최근 시리즈 조회 실패')
  return data.series ?? []
}

export default function RecentSeriesSection() {
  const [series, setSeries] = useState<RecentSeriesItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setSeries(await fetchRecentSeries())
      } catch (err) {
        setError(err instanceof Error ? err.message : '조회 실패')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-bt-title">최근 만든 카드뉴스</h2>
        <Link href="/admin/marketing/card-news" className="text-sm text-bt-link hover:underline">
          전체 보기
        </Link>
      </div>

      {loading && <p className="text-sm text-bt-body/60">불러오는 중…</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      {!loading && !error && series.length === 0 && (
        <p className="text-sm text-bt-body/60">아직 만든 카드뉴스 시리즈가 없습니다.</p>
      )}

      {series.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {series.map((s) => {
            const cities = s.selectedCities.length ? s.selectedCities.join(' · ') : s.themeTitle
            const nightsDays =
              s.tripNights && s.tripDays ? `${s.tripNights}박 ${s.tripDays}일` : null
            const statusLabel = CARD_NEWS_SERIES_STATUS_LABEL[s.status] ?? s.status
            return (
              <Link
                key={s.id}
                href={`/admin/marketing/card-news/${s.id}`}
                className="block rounded-xl border border-bt-border-strong bg-white p-4 shadow-sm transition hover:border-bt-brand-blue/40"
              >
                <div className="font-medium text-bt-title">{cities}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-bt-body/70">
                  {s.seasonLabel && (
                    <span className="rounded-full bg-bt-surface-soft px-2 py-0.5">{s.seasonLabel}</span>
                  )}
                  {nightsDays && (
                    <span className="rounded-full bg-bt-surface-soft px-2 py-0.5">{nightsDays}</span>
                  )}
                  <span className="rounded-full bg-bt-surface-soft px-2 py-0.5">{s.episodeCount}편</span>
                  <span className="rounded-full bg-bt-surface-soft px-2 py-0.5">{statusLabel}</span>
                </div>
                <p className="mt-2 text-xs text-bt-body/50">
                  {new Date(s.createdAt).toLocaleString('ko-KR')}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
