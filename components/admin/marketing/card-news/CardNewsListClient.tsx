'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import SeriesCard, { type SeriesCardData } from '@/components/admin/marketing/card-news/SeriesCard'

export default function CardNewsListClient() {
  const [series, setSeries] = useState<SeriesCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/marketing/card-news/series')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '목록 조회 실패')
      setSeries(Array.isArray(data.series) ? data.series : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록 조회 실패')
      setSeries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-bt-title">카드뉴스</h1>
          <p className="mt-1 text-sm text-bt-body/70">인스타그램 카드뉴스 시리즈·편 관리</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/marketing" className="text-sm text-bt-brand-blue hover:underline">
            ← 마케팅 개요
          </Link>
          <Link
            href="/admin/marketing/card-news/new"
            className="rounded-lg bg-bt-brand-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            + 새 시리즈 만들기
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-bt-body/70">불러오는 중…</p>
      ) : series.length === 0 ? (
        <p className="text-sm text-bt-body/70">시리즈가 없습니다.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {series.map((s) => (
            <SeriesCard key={s.id} series={s} />
          ))}
        </div>
      )}
    </div>
  )
}
