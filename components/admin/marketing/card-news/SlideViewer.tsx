'use client'

import { readAdminResponseJson } from '@/lib/admin/read-admin-response-json'

import { useState } from 'react'

export type SlideRow = {
  id: string
  slideNumber: number
  headline: string
  subtitle: string | null
  body: string | null
  pexelsKeyword: string | null
}

type Props = {
  seriesId: string
  episodeId: string
  slides: SlideRow[]
  onUpdated: () => void
}

export default function SlideViewer({ seriesId, episodeId, slides, onUpdated }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [headlineDraft, setHeadlineDraft] = useState('')
  const [subtitleDraft, setSubtitleDraft] = useState('')
  const [bodyDraft, setBodyDraft] = useState('')
  const [keywordDraft, setKeywordDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function startEdit(slide: SlideRow) {
    setEditingId(slide.id)
    setHeadlineDraft(slide.headline ?? '')
    setSubtitleDraft(slide.subtitle ?? '')
    setBodyDraft(slide.body ?? '')
    setKeywordDraft(slide.pexelsKeyword ?? '')
    setError('')
  }

  async function save(slideId: string) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(
        `/api/admin/marketing/card-news/series/${seriesId}/episodes/${episodeId}/slides/${slideId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            headline: headlineDraft,
            subtitle: subtitleDraft || null,
            body: bodyDraft,
            pexelsKeyword: keywordDraft,
          }),
        },
      )
      const data = await readAdminResponseJson(res)
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      setEditingId(null)
      onUpdated()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  if (!slides.length) {
    return <p className="text-sm text-bt-body/60">슬라이드가 없습니다. [전체 카피 생성]을 실행하세요.</p>
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}
      {slides.map((slide) => (
        <div key={slide.id} className="rounded-lg border border-bt-border-strong bg-white p-4">
          <p className="text-xs font-medium text-bt-body/60">{slide.slideNumber}/5</p>
          {editingId === slide.id ? (
            <div className="mt-2 space-y-3">
              <label className="block text-sm">
                <span className="text-bt-body/80">헤드라인 (12자 이내)</span>
                <input
                  value={headlineDraft}
                  onChange={(e) => setHeadlineDraft(e.target.value)}
                  maxLength={12}
                  className="mt-1 w-full rounded border border-bt-border-strong px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-bt-body/80">부제 (15자 이내)</span>
                <input
                  value={subtitleDraft}
                  onChange={(e) => setSubtitleDraft(e.target.value)}
                  maxLength={15}
                  className="mt-1 w-full rounded border border-bt-border-strong px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-bt-body/80">본문 (50자 이내)</span>
                <textarea
                  value={bodyDraft}
                  onChange={(e) => setBodyDraft(e.target.value)}
                  rows={3}
                  maxLength={50}
                  className="mt-1 w-full rounded border border-bt-border-strong px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-bt-body/80">Pexels 키워드</span>
                <input
                  value={keywordDraft}
                  onChange={(e) => setKeywordDraft(e.target.value)}
                  className="mt-1 w-full rounded border border-bt-border-strong px-3 py-2 text-sm"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save(slide.id)}
                  className="rounded-lg bg-bt-brand-blue px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-lg border border-bt-border-strong px-3 py-1.5 text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <>
              <h4 className="mt-1 text-lg font-bold text-bt-title">
                {slide.headline || '(헤드라인 없음)'}
              </h4>
              {slide.subtitle && (
                <p className="mt-1 text-sm font-medium text-bt-body/80">{slide.subtitle}</p>
              )}
              <p className="mt-2 whitespace-pre-wrap text-sm text-bt-title">
                {slide.body || '(본문 없음)'}
              </p>
              <p className="mt-2 text-sm text-bt-body/70">
                Pexels: <span className="font-mono">{slide.pexelsKeyword || '—'}</span>
              </p>
              <button
                type="button"
                onClick={() => startEdit(slide)}
                className="mt-2 text-sm text-bt-brand-blue hover:underline"
              >
                편집
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
