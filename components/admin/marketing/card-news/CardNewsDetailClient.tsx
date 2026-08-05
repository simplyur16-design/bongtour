'use client'

import { readAdminResponseJson } from '@/lib/admin/read-admin-response-json'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import EpisodeCard, { type EpisodeCardData } from '@/components/admin/marketing/card-news/EpisodeCard'
import EpisodeForm, { type EpisodeFormValues } from '@/components/admin/marketing/card-news/EpisodeForm'
import SeriesForm, { type SeriesFormValues } from '@/components/admin/marketing/card-news/SeriesForm'
import {
  CARD_NEWS_SERIES_STATUS_LABEL,
  seasonLabel,
} from '@/lib/bong-marketing/card-news-admin-constants'

type SeriesDetail = {
  id: string
  weekKey: string
  themeTitle: string
  selectedCities: string[]
  tripNights: number
  tripDays: number
  season: string | null
  status: string
  operatorNote: string | null
  episodes: EpisodeCardData[]
}

export default function CardNewsDetailClient({ seriesId }: { seriesId: string }) {
  const router = useRouter()
  const [series, setSeries] = useState<SeriesDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [metaOpen, setMetaOpen] = useState(false)
  const [episodeOpen, setEpisodeOpen] = useState(false)
  const [editEpisode, setEditEpisode] = useState<EpisodeCardData | null>(null)
  const [generating, setGenerating] = useState(false)
  const [quickAdding, setQuickAdding] = useState(false)
  const [showBlogTrackModal, setShowBlogTrackModal] = useState(false)
  const [creatingBlog, setCreatingBlog] = useState(false)
  const [blogError, setBlogError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/marketing/card-news/series/${seriesId}`)
      const data = await readAdminResponseJson(res)
      if (!res.ok) throw new Error(data.error ?? '조회 실패')
      setSeries(data.series)
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패')
      setSeries(null)
    } finally {
      setLoading(false)
    }
  }, [seriesId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleGenerate() {
    if (!series || series.episodes.length === 0) return
    if (!confirm('시리즈 내 모든 편의 카피를 생성합니다. 계속할까요?')) return
    setGenerating(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/marketing/card-news/series/${seriesId}/generate`, {
        method: 'POST',
      })
      const data = await readAdminResponseJson(res)
      if (!res.ok) throw new Error(data.error ?? '생성 실패')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성 실패')
    } finally {
      setGenerating(false)
    }
  }

  async function handleCreateBlogFromSeries(track: 'package' | 'airtel') {
    setCreatingBlog(true)
    setBlogError(null)
    try {
      const res = await fetch('/api/admin/marketing/blog/from-series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesId, contentTrack: track }),
      })
      const json = await readAdminResponseJson<{ redirectTo?: string; error?: string }>(res)
      if (!res.ok) throw new Error(json.error ?? '블로그 생성 실패')
      if (json.redirectTo) {
        router.push(json.redirectTo)
      }
    } catch (e) {
      setBlogError(e instanceof Error ? e.message : '블로그 생성 실패')
    } finally {
      setCreatingBlog(false)
      setShowBlogTrackModal(false)
    }
  }

  async function handleDeleteSeries() {
    if (!confirm('시리즈와 모든 편·슬라이드를 삭제합니다. 계속할까요?')) return
    const res = await fetch(`/api/admin/marketing/card-news/series/${seriesId}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await readAdminResponseJson(res)
      setError(data.error ?? '삭제 실패')
      return
    }
    router.push('/admin/marketing/card-news')
  }

  async function saveEpisode(values: EpisodeFormValues, episodeId?: string) {
    const payload = {
      title: values.title,
      episodeType: values.episodeType,
      formatType: values.formatType,
      targetCity: values.targetCity || null,
      targetPlace: values.targetPlace || null,
      operatorNote: values.operatorNote || null,
      linkedProductId: values.linkedProductId,
    }
    const url = episodeId
      ? `/api/admin/marketing/card-news/series/${seriesId}/episodes/${episodeId}`
      : `/api/admin/marketing/card-news/series/${seriesId}/episodes`
    const res = await fetch(url, {
      method: episodeId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await readAdminResponseJson(res)
    if (!res.ok) throw new Error(data.error ?? '저장 실패')
    await load()
  }

  async function handleQuickAdd(type: 'tip' | 'caution') {
    if (!series) return
    const city = series.selectedCities[0] ?? ''
    const title = type === 'tip' ? `${city || '여행지'} 여행팁` : `${city || '여행지'} 주의사항`
    setQuickAdding(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/marketing/card-news/series/${seriesId}/episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeType: type,
          formatType: 'list',
          title,
          targetCity: city || null,
          operatorNote: `[자동 생성] ${type === 'tip' ? '여행팁' : '주의사항'} 빠른 추가`,
        }),
      })
      const data = await readAdminResponseJson(res)
      if (!res.ok) throw new Error(data.error ?? '편 추가 실패')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '편 추가 실패')
    } finally {
      setQuickAdding(false)
    }
  }

  if (loading) return <p className="text-sm text-bt-body/70">불러오는 중…</p>
  if (!series) {
    return (
      <div>
        <p className="text-sm text-red-700">{error || '시리즈를 찾을 수 없습니다.'}</p>
        <Link href="/admin/marketing/card-news" className="mt-4 inline-block text-sm text-bt-brand-blue">
          ← 목록
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/marketing/card-news" className="text-sm text-bt-brand-blue hover:underline">
            ← 카드뉴스 목록
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-bt-title">{series.themeTitle}</h1>
          <p className="mt-1 text-sm text-bt-body/80">
            {series.weekKey} · {series.tripNights}박 {series.tripDays}일 · {seasonLabel(series.season)} ·{' '}
            {CARD_NEWS_SERIES_STATUS_LABEL[series.status] ?? series.status}
          </p>
          <p className="mt-1 text-sm text-bt-body/70">도시: {series.selectedCities.join(', ') || '—'}</p>
          {series.operatorNote && (
            <p className="mt-1 text-sm text-bt-body/60">메모: {series.operatorNote}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMetaOpen(true)}
            className="rounded-lg border border-bt-border-strong px-3 py-1.5 text-sm hover:bg-bt-surface-soft"
          >
            시리즈 메타 수정
          </button>
          <button
            type="button"
            disabled={generating || series.episodes.length === 0}
            onClick={() => void handleGenerate()}
            className="rounded-lg bg-bt-brand-blue px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {generating ? '생성 중…' : '전체 카피 생성'}
          </button>
          <button
            type="button"
            disabled={creatingBlog || series.episodes.length === 0}
            onClick={() => {
              setBlogError(null)
              setShowBlogTrackModal(true)
            }}
            className="rounded-lg border border-bt-border-strong px-3 py-1.5 text-sm hover:bg-bt-surface-soft disabled:opacity-50"
          >
            {creatingBlog ? '블로그 생성 중…' : '블로그 만들기'}
          </button>
          <button
            type="button"
            onClick={() => void handleDeleteSeries()}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
          >
            시리즈 삭제
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}
      {blogError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{blogError}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-bt-title">편 목록</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={quickAdding}
            onClick={() => void handleQuickAdd('tip')}
            className="rounded-lg border border-bt-border-strong px-3 py-1.5 text-sm hover:bg-bt-surface-soft disabled:opacity-50"
          >
            + 여행팁 편 추가
          </button>
          <button
            type="button"
            disabled={quickAdding}
            onClick={() => void handleQuickAdd('caution')}
            className="rounded-lg border border-bt-border-strong px-3 py-1.5 text-sm hover:bg-bt-surface-soft disabled:opacity-50"
          >
            + 주의사항 편 추가
          </button>
          <button
            type="button"
            onClick={() => {
              setEditEpisode(null)
              setEpisodeOpen(true)
            }}
            className="rounded-lg border border-bt-border-strong px-3 py-1.5 text-sm hover:bg-bt-surface-soft"
          >
            + 직접 만들기
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {series.episodes.map((ep) => (
          <EpisodeCard
            key={ep.id}
            seriesId={seriesId}
            episode={ep}
            onEdit={() => {
              setEditEpisode(ep)
              setEpisodeOpen(true)
            }}
            onDelete={async () => {
              const res = await fetch(
                `/api/admin/marketing/card-news/series/${seriesId}/episodes/${ep.id}`,
                { method: 'DELETE' },
              )
              if (!res.ok) {
                const data = await readAdminResponseJson(res)
                throw new Error(data.error ?? '삭제 실패')
              }
              await load()
            }}
            onRefresh={() => void load()}
          />
        ))}
        {series.episodes.length === 0 && (
          <p className="text-sm text-bt-body/60">편이 없습니다. 새 편을 추가하세요.</p>
        )}
      </div>

      {metaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">시리즈 메타 수정</h2>
            <div className="mt-4">
              <SeriesForm
                initial={{
                  weekKey: series.weekKey,
                  themeTitle: series.themeTitle,
                  tripNights: series.tripNights,
                  tripDays: series.tripDays,
                  season: series.season ?? '',
                  operatorNote: series.operatorNote ?? '',
                  selectedCities: series.selectedCities,
                }}
                seriesId={seriesId}
                submitLabel="저장"
                onRecommendCities={async (id) => {
                  const res = await fetch(
                    `/api/admin/marketing/card-news/series/${id}/recommend-cities`,
                    { method: 'POST' },
                  )
                  const data = await readAdminResponseJson(res)
                  if (!res.ok) throw new Error(data.error ?? '추천 실패')
                  return data.recommendation?.cities ?? data.series?.selectedCities ?? []
                }}
                onSubmit={async (values: SeriesFormValues) => {
                  const res = await fetch(`/api/admin/marketing/card-news/series/${seriesId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      weekKey: values.weekKey,
                      themeTitle: values.themeTitle,
                      tripNights: values.tripNights,
                      tripDays: values.tripDays,
                      season: values.season || null,
                      operatorNote: values.operatorNote || null,
                      selectedCities: values.selectedCities,
                    }),
                  })
                  const data = await readAdminResponseJson(res)
                  if (!res.ok) throw new Error(data.error ?? '저장 실패')
                  setMetaOpen(false)
                  await load()
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setMetaOpen(false)}
              className="mt-4 text-sm text-bt-body/70 hover:underline"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <EpisodeForm
        open={episodeOpen}
        title={editEpisode ? '편 수정' : '새 편 추가'}
        cityOptions={series.selectedCities}
        initial={
          editEpisode
            ? {
                title: editEpisode.title,
                episodeType: editEpisode.episodeType as EpisodeFormValues['episodeType'],
                formatType: editEpisode.formatType as EpisodeFormValues['formatType'],
                targetCity: editEpisode.targetCity ?? '',
                targetPlace: editEpisode.targetPlace ?? '',
                operatorNote: editEpisode.operatorNote ?? '',
                linkedProduct: editEpisode.linkedProduct
                  ? { ...editEpisode.linkedProduct, primaryDestination: null }
                  : null,
              }
            : undefined
        }
        submitLabel="저장"
        onClose={() => {
          setEpisodeOpen(false)
          setEditEpisode(null)
        }}
        onSubmit={async (values) => saveEpisode(values, editEpisode?.id)}
      />

      {showBlogTrackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-bt-title">이 시리즈로 블로그 글 만들기</h3>
            <p className="mt-2 text-sm text-bt-body/70">
              시리즈의 모든 편(패키지·여행팁·주의사항)을 통합한 8단락 블로그 글을 생성합니다. 1-2분 소요될 수
              있어요.
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                disabled={creatingBlog}
                onClick={() => void handleCreateBlogFromSeries('package')}
                className="w-full rounded-lg border border-bt-border-strong px-3 py-2 text-left text-sm hover:bg-bt-surface-soft disabled:opacity-50"
              >
                패키지 트랙
              </button>
              <button
                type="button"
                disabled={creatingBlog}
                onClick={() => void handleCreateBlogFromSeries('airtel')}
                className="w-full rounded-lg border border-bt-border-strong px-3 py-2 text-left text-sm hover:bg-bt-surface-soft disabled:opacity-50"
              >
                자유여행 트랙
              </button>
            </div>
            <button
              type="button"
              disabled={creatingBlog}
              onClick={() => setShowBlogTrackModal(false)}
              className="mt-4 text-sm text-bt-body/70 hover:underline disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
