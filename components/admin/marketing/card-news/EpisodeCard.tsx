'use client'

import { useState } from 'react'
import SlideViewer from '@/components/admin/marketing/card-news/SlideViewer'
import { CARD_NEWS_EPISODE_STATUS_LABEL } from '@/lib/bong-marketing/card-news-admin-constants'

export type EpisodeCardData = {
  id: string
  episodeNumber: number
  title: string
  episodeType: string
  formatType: string
  status: string
  targetCity: string | null
  targetPlace: string | null
  operatorNote: string | null
  caption: string | null
  hashtags: string[]
  linkedProduct: { id: string; title: string; country: string | null; city: string | null } | null
  slides: {
    id: string
    slideNumber: number
    headline: string
    subtitle: string | null
    body: string | null
    pexelsKeyword: string | null
  }[]
}

type Props = {
  seriesId: string
  episode: EpisodeCardData
  onEdit: () => void
  onDelete: () => Promise<void>
  onRefresh: () => void
}

export default function EpisodeCard({ seriesId, episode, onEdit, onDelete, onRefresh }: Props) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [captionLoading, setCaptionLoading] = useState(false)
  const [captionError, setCaptionError] = useState('')
  const [copyMsg, setCopyMsg] = useState('')

  async function handleDelete() {
    if (!confirm(`편 ${episode.episodeNumber}을(를) 삭제할까요?`)) return
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
    }
  }

  async function handleGenerateCaption() {
    if (!episode.slides.length) {
      setCaptionError('슬라이드가 없습니다. 먼저 카피를 생성하세요.')
      return
    }
    if (
      episode.caption &&
      !confirm('기존 캡션을 덮어씁니다. 계속할까요?')
    ) {
      return
    }
    setCaptionLoading(true)
    setCaptionError('')
    try {
      const res = await fetch(`/api/admin/marketing/card-news/episodes/${episode.id}/caption`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '캡션 생성 실패')
      onRefresh()
    } catch (e) {
      setCaptionError(e instanceof Error ? e.message : '캡션 생성 실패')
    } finally {
      setCaptionLoading(false)
    }
  }

  async function handleCopyCaption() {
    if (!episode.caption) return
    const text = `${episode.caption}\n\n${episode.hashtags.join(' ')}`
    try {
      await navigator.clipboard.writeText(text)
      setCopyMsg('복사됨')
      setTimeout(() => setCopyMsg(''), 2000)
    } catch {
      setCopyMsg('복사 실패')
    }
  }

  return (
    <div className="rounded-xl border border-bt-border-strong bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div>
          <p className="text-xs text-bt-body/60">{episode.episodeNumber}편</p>
          <h3 className="text-base font-semibold text-bt-title">{episode.title}</h3>
          <p className="mt-1 text-sm text-bt-body/80">
            {episode.formatType === 'deep' ? 'Deep' : 'List'} · {episode.episodeType}
            {episode.linkedProduct ? ` · 연결: ${episode.linkedProduct.title}` : ''}
          </p>
          <p className="mt-1 text-sm text-bt-body/70">
            상태: {CARD_NEWS_EPISODE_STATUS_LABEL[episode.status] ?? episode.status} · 슬라이드{' '}
            {episode.slides.length}장
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-bt-border-strong px-3 py-1.5 text-sm hover:bg-bt-surface-soft"
          >
            편 수정
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void handleDelete()}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            편 삭제
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg bg-bt-surface-soft px-3 py-1.5 text-sm"
          >
            {open ? '접기' : '펼침'}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-bt-border-strong bg-bt-surface-soft/50 p-4">
          <SlideViewer
            seriesId={seriesId}
            episodeId={episode.id}
            slides={episode.slides}
            onUpdated={onRefresh}
          />

          <div className="mt-4 border-t border-bt-border-strong pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h5 className="text-sm font-medium text-bt-title">인스타 캡션</h5>
              <button
                type="button"
                disabled={captionLoading}
                onClick={() => void handleGenerateCaption()}
                className="rounded-lg border border-bt-border-strong bg-white px-3 py-1.5 text-sm hover:bg-bt-surface-soft disabled:opacity-50"
              >
                {captionLoading ? '생성 중…' : episode.caption ? '캡션 재생성' : '캡션 생성'}
              </button>
            </div>
            {captionError && (
              <p className="mt-2 text-sm text-red-700">{captionError}</p>
            )}
            {episode.caption ? (
              <>
                <p className="mt-2 whitespace-pre-wrap text-sm text-bt-title">{episode.caption}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {episode.hashtags.map((tag, i) => (
                    <span
                      key={`${tag}-${i}`}
                      className="rounded bg-bt-surface-soft px-2 py-1 text-xs text-bt-body/80"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyCaption()}
                  className="mt-2 text-xs text-bt-brand-blue hover:underline"
                >
                  {copyMsg || '캡션 + 해시태그 복사'}
                </button>
              </>
            ) : (
              <p className="mt-2 text-sm text-bt-body/60">캡션 생성 전</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
