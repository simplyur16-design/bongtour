'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import type { HomeHubCardImageKey } from '@/lib/home-hub-images'
import type { HomeHubCandidateRecord } from '@/lib/home-hub-candidates-types'
import type { HubImageSeasonKey } from '@/lib/home-hub-image-prompts'
import { homeHubActiveFileToClientModel, type HomeHubActiveClientModel } from '@/lib/home-hub-active-client-model'
import type { HomeHubActiveFile } from '@/lib/home-hub-resolve-images'

const CARDS: { key: HomeHubCardImageKey | ''; label: string }[] = [
  { key: '', label: '전체 카드' },
  { key: 'overseas', label: '해외여행' },
  { key: 'training', label: '국외연수' },
  { key: 'domestic', label: '국내여행' },
  { key: 'esim', label: 'eSIM' },
]

const SEASONS: { key: HubImageSeasonKey | ''; label: string }[] = [
  { key: '', label: '전체 시즌' },
  { key: 'default', label: '기본' },
  { key: 'spring', label: '봄' },
  { key: 'summer', label: '여름' },
  { key: 'autumn', label: '가을' },
  { key: 'winter', label: '겨울' },
]

const SEASON_BADGE_LABEL: Record<string, string> = {
  default: '시즌 · 기본',
  spring: '시즌 · 봄',
  summer: '시즌 · 여름',
  autumn: '시즌 · 가을',
  winter: '시즌 · 겨울',
}

type Props = {
  refreshToken: number
  cardLabels: Record<HomeHubCardImageKey, string>
  /** 메인에 올라간 URL(카드별). 후보 카드와 비교해 “지금 메인” 강조에 사용 */
  mainImages?: HomeHubActiveClientModel['images']
  onActivated: (active: HomeHubActiveClientModel) => void
  onActivateError?: (message: string) => void
  /** 후보 삭제 후 상위에서 활성 요약·라우트 갱신 */
  onCandidateDeleted?: () => void
}

function summarizePrompt(text: string, max = 80) {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export function HomeHubImageCandidateGrid({
  refreshToken,
  cardLabels,
  mainImages,
  onActivated,
  onActivateError,
  onCandidateDeleted,
}: Props) {
  const [filterCard, setFilterCard] = useState<HomeHubCardImageKey | ''>('')
  const [filterSeason, setFilterSeason] = useState<HubImageSeasonKey | ''>('')
  const [items, setItems] = useState<HomeHubCandidateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [preview, setPreview] = useState<HomeHubCandidateRecord | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams()
      if (filterCard) q.set('cardKey', filterCard)
      if (filterSeason) q.set('season', filterSeason)
      const res = await fetch(`/api/admin/home-hub-images/candidates?${q.toString()}`)
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        items?: HomeHubCandidateRecord[]
        error?: string
      }
      if (!res.ok || !data.ok) {
        setError(
          data.error ||
            `후보 JSON을 읽지 못했습니다(HTTP ${res.status}). public/data/home-hub-candidates.json 권한·형식을 확인하거나 페이지를 새로고침하세요.`
        )
        setItems([])
        return
      }
      setItems(data.items ?? [])
    } catch {
      setError(
        '목록 요청이 끊겼습니다. 개발 서버·네트워크 상태를 확인한 뒤 다시 시도하세요.'
      )
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [filterCard, filterSeason])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  const activate = async (c: HomeHubCandidateRecord) => {
    setActivatingId(c.id)
    setError(null)
    try {
      const res = await fetch('/api/admin/home-hub-images/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: c.id }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        active?: HomeHubActiveFile
        error?: string
      }
      if (!res.ok || !data.ok || !data.active) {
        const msg =
          data.error ||
          `활성화에 실패했습니다(HTTP ${res.status}). 후보 ID·파일 경로·JSON 쓰기 권한을 확인하세요.`
        setError(msg)
        onActivateError?.(msg)
        return
      }
      onActivated(homeHubActiveFileToClientModel(data.active))
      await load()
    } catch {
      const msg = '활성화 요청이 서버에 도달하지 못했습니다. 연결을 확인하세요.'
      setError(msg)
      onActivateError?.(msg)
    } finally {
      setActivatingId(null)
    }
  }

  const handleDelete = async (c: HomeHubCandidateRecord) => {
    if (
      !confirm(
        '이 후보를 삭제할까요? 디스크의 후보 파일도 함께 지워집니다. 이 이미지가 메인에 적용 중이면 해당 카드는 기본 이미지로 돌아갑니다.'
      )
    ) {
      return
    }
    setDeletingId(c.id)
    setError(null)
    try {
      const res = await fetch('/api/admin/home-hub-images/candidates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: c.id }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? `삭제 실패(HTTP ${res.status})`)
        return
      }
      if (preview?.id === c.id) setPreview(null)
      onCandidateDeleted?.()
      await load()
    } catch {
      setError('삭제 요청이 서버에 도달하지 못했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  const selectClass =
    'mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/80 p-5">
      <h2 className="text-sm font-semibold text-slate-200">후보 갤러리</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-xs text-slate-400">
          카드 필터
          <select
            className={selectClass}
            value={filterCard}
            onChange={(e) => setFilterCard(e.target.value as HomeHubCardImageKey | '')}
          >
            {CARDS.map((c) => (
              <option key={c.key || 'all'} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-400">
          시즌 필터
          <select
            className={selectClass}
            value={filterSeason}
            onChange={(e) => setFilterSeason(e.target.value as HubImageSeasonKey | '')}
          >
            {SEASONS.map((s) => (
              <option key={s.key || 'all'} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-500/35 bg-red-950/25 px-3 py-2 text-sm leading-relaxed text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">후보 목록을 불러오는 중입니다…</p>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-slate-600 bg-slate-950/50 px-4 py-5 text-sm leading-relaxed text-slate-400">
          <p className="font-medium text-slate-300">아직 저장된 후보가 없습니다.</p>
          <p className="mt-2">
            위 <span className="text-slate-200">후보 생성</span>에서 카드·시즌·프롬프트를 정한 뒤 생성하면
            여기에 쌓입니다. 제미나이가 실패하면 같은 수만큼 <span className="text-amber-200/90">스텁</span>(베이스
            이미지 복사)으로도 추가될 수 있습니다.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            파일 위치: <code className="text-slate-400">public/data/home-hub-candidates.json</code>
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => {
            const mainUrl = mainImages?.[c.cardKey]?.trim()
            const isOnMain =
              Boolean(mainUrl) && mainUrl === c.imagePath.trim()
            const seasonBadge = SEASON_BADGE_LABEL[c.season] ?? `시즌 · ${c.season}`
            const liveFrame = isOnMain
              ? 'ring-2 ring-teal-400 ring-offset-2 ring-offset-slate-950 border-2 border-teal-500 shadow-[0_0_24px_rgba(45,212,191,0.12)]'
              : 'border border-slate-700/80'

            return (
              <li
                key={c.id}
                className={`flex flex-col overflow-hidden rounded-lg bg-slate-950/40 ${liveFrame}`}
              >
                <div className="relative">
                  {isOnMain ? (
                    <div className="absolute left-2 top-2 z-10 rounded-md border border-teal-400/80 bg-teal-950/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-teal-100 shadow-md">
                      지금 메인 적용 중
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="relative block aspect-[16/9] w-full cursor-zoom-in bg-slate-800 text-left"
                    onClick={() => setPreview(c)}
                    title="확대 보기"
                  >
                    <Image
                      src={c.imagePath}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width:1024px) 50vw, 33vw"
                      unoptimized={/^https?:\/\//i.test(c.imagePath)}
                    />
                  </button>
                </div>
                <button
                  type="button"
                  disabled={!!activatingId || !!deletingId}
                  onClick={() => void handleDelete(c)}
                  className="w-full border-t border-slate-700/90 bg-slate-950/60 py-2 text-center text-xs font-medium text-red-300/95 hover:bg-red-950/35 disabled:opacity-50"
                >
                  {deletingId === c.id ? '삭제 중…' : '삭제'}
                </button>
                <div className="flex flex-1 flex-col gap-2 p-3 text-xs">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center rounded border border-slate-500/60 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                      카드 · {cardLabels[c.cardKey]}
                    </span>
                    <span className="inline-flex items-center rounded border border-violet-500/45 bg-violet-950/60 px-2 py-0.5 text-[10px] font-semibold text-violet-100">
                      {seasonBadge}
                    </span>
                    {isOnMain || c.isActive ? (
                      <span className="inline-flex items-center rounded border border-teal-400/70 bg-teal-900/90 px-2 py-0.5 text-[10px] font-bold text-teal-50">
                        상태 · 메인 활성
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded border border-slate-600 bg-slate-800/90 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                        상태 · 후보만
                      </span>
                    )}
                    {c.generationProvider === 'stub' ? (
                      <span className="inline-flex items-center rounded border border-amber-500/60 bg-amber-950/70 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                        출처 · 스텁(제미나이 미사용/실패)
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded border border-sky-500/45 bg-sky-950/50 px-2 py-0.5 text-[10px] font-semibold text-sky-100">
                        출처 · Gemini
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-[11px] text-slate-500" title={c.promptText}>
                    {summarizePrompt(c.promptText, 120)}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    생성{' '}
                    {new Date(c.createdAt).toLocaleString('ko-KR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                  <a
                    href="/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-center text-[11px] font-medium text-teal-400/90 underline-offset-2 hover:text-teal-300 hover:underline"
                  >
                    메인에서 보기 (새 탭)
                  </a>
                  <button
                    type="button"
                    disabled={!!activatingId}
                    onClick={() => void activate(c)}
                    className="mt-1 rounded-lg bg-slate-800 py-2 text-center text-xs font-medium text-teal-200 hover:bg-slate-700 disabled:opacity-50"
                  >
                    {activatingId === c.id ? '적용 중…' : '이 이미지를 메인에 활성화'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(null)}
        >
          <div
            className="max-h-[90vh] max-w-4xl overflow-auto rounded-xl border border-slate-600 bg-slate-900 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-video w-full min-w-[280px] max-w-3xl">
              <Image
                src={preview.imagePath}
                alt=""
                fill
                className="object-contain"
                sizes="100vw"
                unoptimized={/^https?:\/\//i.test(preview.imagePath)}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">{preview.promptText}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-teal-300 hover:underline"
              >
                메인에서 보기
              </a>
              <button
                type="button"
                className="text-sm text-slate-400 hover:text-slate-200"
                onClick={() => setPreview(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
