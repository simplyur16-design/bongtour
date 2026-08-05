'use client'

import { readAdminResponseJson } from '@/lib/admin/read-admin-response-json'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import SeriesForm, { type SeriesFormValues } from '@/components/admin/marketing/card-news/SeriesForm'

function seriesPayload(values: SeriesFormValues) {
  return {
    weekKey: values.weekKey,
    themeTitle: values.themeTitle,
    tripNights: values.tripNights,
    tripDays: values.tripDays,
    season: values.season || null,
    operatorNote: values.operatorNote || null,
    selectedCities: values.selectedCities,
  }
}

export default function CardNewsNewPage() {
  const router = useRouter()
  const searchParams = useSearchParams() ?? new URLSearchParams()
  const [draftId, setDraftId] = useState<string | undefined>()

  const formInitial = useMemo(() => {
    const themeTitle = searchParams.get('themeTitle')?.trim()
    const season = searchParams.get('season')?.trim()
    const citiesRaw = searchParams.get('cities')?.trim()
    const selectedCities = citiesRaw
      ? citiesRaw.split(',').map((c) => c.trim()).filter(Boolean)
      : undefined
    if (!themeTitle && !season && !selectedCities?.length) return undefined
    return {
      ...(themeTitle ? { themeTitle } : {}),
      ...(season ? { season } : {}),
      ...(selectedCities?.length ? { selectedCities } : {}),
    }
  }, [searchParams])

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/marketing/card-news" className="text-sm text-bt-brand-blue hover:underline">
          ← 카드뉴스 목록
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-bt-title">새 시리즈 만들기</h1>
      </div>
      <SeriesForm
        initial={formInitial}
        seriesId={draftId}
        submitLabel="저장"
        beforeRecommend={async (values) => {
          if (draftId) {
            const res = await fetch(`/api/admin/marketing/card-news/series/${draftId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(seriesPayload(values)),
            })
            const data = await readAdminResponseJson(res)
            if (!res.ok) throw new Error(data.error ?? '시리즈 업데이트 실패')
            return draftId
          }
          const res = await fetch('/api/admin/marketing/card-news/series', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(seriesPayload(values)),
          })
          const data = await readAdminResponseJson(res)
          if (!res.ok) throw new Error(data.error ?? '시리즈 생성 실패')
          setDraftId(data.series.id)
          return data.series.id as string
        }}
        onRecommendCities={async (id) => {
          const res = await fetch(`/api/admin/marketing/card-news/series/${id}/recommend-cities`, {
            method: 'POST',
          })
          const data = await readAdminResponseJson(res)
          if (!res.ok) throw new Error(data.error ?? '도시 추천 실패')
          return Array.isArray(data.series?.selectedCities) ? data.series.selectedCities : []
        }}
        onSubmit={async (values) => {
          if (draftId) {
            const res = await fetch(`/api/admin/marketing/card-news/series/${draftId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(seriesPayload(values)),
            })
            const data = await readAdminResponseJson(res)
            if (!res.ok) throw new Error(data.error ?? '저장 실패')
            router.push(`/admin/marketing/card-news/${data.series.id}`)
            return
          }
          const res = await fetch('/api/admin/marketing/card-news/series', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(seriesPayload(values)),
          })
          const data = await readAdminResponseJson(res)
          if (!res.ok) throw new Error(data.error ?? '저장 실패')
          router.push(`/admin/marketing/card-news/${data.series.id}`)
        }}
      />
    </div>
  )
}
