'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import type { HomeHubCardImageKey } from '@/lib/home-hub-images'
import type { HomeHubActiveClientModel } from '@/lib/home-hub-active-client-model'
import type { HomeHubCardImageSourceMode } from '@/lib/home-hub-card-hybrid-core'
import {
  effectiveHomeHubCardImageSourceMode,
  getHomeHubCardHybridResolutionDetail,
} from '@/lib/home-hub-card-hybrid-core'
import type { HomeHubActiveFile } from '@/lib/home-hub-resolve-images'
import type { HomeHubCandidateRecord } from '@/lib/home-hub-candidates-types'

const KEYS: HomeHubCardImageKey[] = ['overseas', 'training', 'domestic', 'bus']

export type TravelPoolPreview = { overseas: string | null; domestic: string | null }

type Props = {
  cardLabels: Record<HomeHubCardImageKey, string>
  active: HomeHubActiveClientModel | null
  initialTravelPool: TravelPoolPreview
  onSaved: (active: HomeHubActiveFile) => void
  onSaveError?: (message: string) => void
  /** 후보 갤러리와 같이 올리면, 생성·삭제 후 국외연수 후보 목록이 다시 불러와집니다. */
  candidatesRefreshToken?: number
}

function badgeClass(tier: string) {
  if (tier === 'manual') return 'border-amber-500/60 bg-amber-950/50 text-amber-200'
  if (tier === 'product_pool') return 'border-teal-500/60 bg-teal-950/50 text-teal-200'
  return 'border-slate-600 bg-slate-800 text-slate-300'
}

export function HomeHubHybridCardOperationsPanel({
  cardLabels,
  active,
  initialTravelPool,
  onSaved,
  onSaveError,
  candidatesRefreshToken = 0,
}: Props) {
  const [poolPreview, setPoolPreview] = useState<TravelPoolPreview>(initialTravelPool)
  const [modeDraft, setModeDraft] = useState<Partial<Record<HomeHubCardImageKey, HomeHubCardImageSourceMode>>>({})
  const [manualDraft, setManualDraft] = useState<Partial<Record<HomeHubCardImageKey, string>>>({})
  /** 국외연수 `/training` 통역 블록 전용 — `home-hub-active.json` `trainingPageSecondaryImage` */
  const [trainingSecondaryDraft, setTrainingSecondaryDraft] = useState('')
  const [trainingCandidates, setTrainingCandidates] = useState<HomeHubCandidateRecord[]>([])
  const [trainingCandidatesLoading, setTrainingCandidatesLoading] = useState(false)
  const [trainingCandidatesError, setTrainingCandidatesError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<HomeHubCardImageKey | null>(null)
  const [poolBusy, setPoolBusy] = useState(false)

  useEffect(() => {
    setPoolPreview(initialTravelPool)
  }, [initialTravelPool])

  const syncDraftsFromActive = useCallback(() => {
    if (!active) {
      setModeDraft({})
      setManualDraft({})
      setTrainingSecondaryDraft('')
      return
    }
    const snap = { images: active.images, imageSourceModes: active.imageSourceModes }
    const m: Partial<Record<HomeHubCardImageKey, HomeHubCardImageSourceMode>> = {}
    const u: Partial<Record<HomeHubCardImageKey, string>> = {}
    for (const k of KEYS) {
      m[k] = effectiveHomeHubCardImageSourceMode(k, snap)
      u[k] = active.images?.[k] ?? ''
    }
    setModeDraft(m)
    setManualDraft(u)
    setTrainingSecondaryDraft(active.trainingPageSecondaryImage?.trim() ?? '')
  }, [active])

  useEffect(() => {
    syncDraftsFromActive()
  }, [syncDraftsFromActive])

  const loadTrainingCandidates = useCallback(async () => {
    setTrainingCandidatesLoading(true)
    setTrainingCandidatesError(null)
    try {
      const res = await fetch('/api/admin/home-hub-images/candidates?cardKey=training')
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        items?: HomeHubCandidateRecord[]
        error?: string
      }
      if (!res.ok || !data.ok) {
        setTrainingCandidates([])
        setTrainingCandidatesError(data.error ?? `후보 목록을 불러오지 못했습니다(HTTP ${res.status}).`)
        return
      }
      const list = data.items ?? []
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setTrainingCandidates(list)
    } catch {
      setTrainingCandidates([])
      setTrainingCandidatesError('후보 목록 요청이 끊겼습니다.')
    } finally {
      setTrainingCandidatesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTrainingCandidates()
  }, [loadTrainingCandidates, candidatesRefreshToken])

  const snapshotForCard = useCallback(
    (key: HomeHubCardImageKey) => {
      if (!active) return null
      return {
        images: { ...active.images, [key]: manualDraft[key] },
        imageSourceModes: { ...active.imageSourceModes, [key]: modeDraft[key] },
      }
    },
    [active, manualDraft, modeDraft],
  )

  const reshufflePool = useCallback(async () => {
    setPoolBusy(true)
    try {
      const res = await fetch('/api/admin/home-hub-travel-cover-pool-preview')
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        overseas?: string | null
        domestic?: string | null
        error?: string
      }
      if (!res.ok || !data.ok) {
        onSaveError?.(data.error ?? '풀 미리보기를 불러오지 못했습니다.')
        return
      }
      setPoolPreview({
        overseas: data.overseas ?? null,
        domestic: data.domestic ?? null,
      })
    } finally {
      setPoolBusy(false)
    }
  }, [onSaveError])

  const patchCard = useCallback(
    async (
      key: HomeHubCardImageKey,
      body: {
        imageSourceModes?: Record<string, string>
        images?: Record<string, string>
        trainingPageSecondaryImage?: string | null
      },
    ) => {
      setSavingKey(key)
      try {
        const res = await fetch('/api/admin/home-hub-card-settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; active?: HomeHubActiveFile; error?: string }
        if (!res.ok || !data.ok || !data.active) {
          onSaveError?.(data.error ?? '저장에 실패했습니다.')
          return
        }
        onSaved(data.active)
      } catch {
        onSaveError?.('저장 요청에 실패했습니다.')
      } finally {
        setSavingKey(null)
      }
    },
    [onSaveError, onSaved],
  )

  const saveCard = async (key: HomeHubCardImageKey) => {
    const mode = modeDraft[key]
    if (!mode) {
      onSaveError?.('모드를 선택하세요.')
      return
    }
    const manual = manualDraft[key] ?? ''
    const trimmedSecondary = trainingSecondaryDraft.trim()
    await patchCard(key, {
      imageSourceModes: { [key]: mode },
      images: { [key]: manual },
      ...(key === 'training'
        ? { trainingPageSecondaryImage: trimmedSecondary ? trimmedSecondary : null }
        : {}),
    })
  }

  const clearManualAndSave = async (key: HomeHubCardImageKey) => {
    if (key !== 'overseas' && key !== 'domestic') return
    await patchCard(key, {
      imageSourceModes: { [key]: 'product_pool' },
      images: { [key]: '' },
    })
  }

  if (!active) {
    return (
      <section className="rounded-xl border-2 border-amber-800/40 bg-slate-950/60 p-5 text-sm text-amber-100/90">
        활성 JSON이 없으면 카드 설정을 표시할 수 없습니다. 후보에서 먼저 활성화하세요.
      </section>
    )
  }

  return (
    <section className="rounded-xl border-2 border-teal-900/50 bg-slate-900/80 p-5 shadow-inner shadow-teal-950/20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-teal-100/95">메인 허브 · 하이브리드 이미지 (운영)</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
            썸네일은 <strong className="text-slate-400">메인과 동일</strong> 우선순위(수동 URL → 상품 풀 → 정적)로 계산됩니다. 해외/국내에 수동 URL이 있으면
            풀이 가려집니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={poolBusy}
            onClick={() => void reshufflePool()}
            className="rounded-lg border border-teal-600/70 bg-teal-950/40 px-3 py-1.5 text-xs font-semibold text-teal-100 hover:bg-teal-900/50 disabled:opacity-50"
          >
            {poolBusy ? '풀 다시 뽑는 중…' : '해외·국내 풀 다시 뽑기 (미리보기)'}
          </button>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800/80"
          >
            메인에서 확인
          </a>
        </div>
      </div>

      <ul className="mt-5 grid gap-4 lg:grid-cols-2">
        {KEYS.map((key) => {
          const snap = snapshotForCard(key)
          const detail = getHomeHubCardHybridResolutionDetail(key, {
            activeSnapshot: snap,
            productPoolOverseasUrl: poolPreview.overseas,
            productPoolDomesticUrl: poolPreview.domestic,
          })
          const poolSupported = key === 'overseas' || key === 'domestic'
          const modeVal = modeDraft[key] ?? effectiveHomeHubCardImageSourceMode(key, active)
          const busy = savingKey === key

          return (
            <li
              key={key}
              className="overflow-hidden rounded-lg border border-teal-800/50 bg-slate-950/50 p-3 ring-1 ring-teal-500/10"
            >
              {key === 'training' ? (
                <div className="mb-3 rounded-md border border-amber-800/40 bg-amber-950/25 px-2.5 py-2 text-[11px] leading-relaxed text-amber-100/95">
                  <p className="font-semibold text-amber-50">국외연수 이미지 2곳 고정하는 법</p>
                  <ol className="mt-1.5 list-decimal space-y-1 pl-4 marker:text-amber-400">
                    <li>
                      아래 <strong className="text-amber-50">①</strong>에 URL 넣기 → 메인 허브 카드 +{' '}
                      <code className="text-amber-200/90">/training</code> 맨 위 사진
                    </li>
                    <li>
                      <strong className="text-amber-50">②</strong>에 다른 URL 넣기 → 같은 페이지의「통역 방식」절 왼쪽 사진만
                    </li>
                    <li>
                      맨 아래 <strong className="text-amber-50">「이 카드 저장」</strong> 한 번 누르기 (①② 같이 저장됨)
                    </li>
                  </ol>
                  <p className="mt-1.5 text-amber-200/80">②를 비우면 ① 이미지가 통역 블록에도 그대로 쓰입니다.</p>
                  <a
                    href="/training"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block font-medium text-teal-300 underline-offset-2 hover:underline"
                  >
                    /training 새 탭에서 확인
                  </a>
                  <div className="mt-2 border-t border-amber-800/30 pt-2">
                    <p className="font-medium text-amber-100/95">생성된 국외연수 후보에서 고르기</p>
                    <p className="mt-0.5 text-[10px] text-amber-200/75">
                      아래 썸네일의 <strong className="text-amber-50">①</strong>·<strong className="text-amber-50">②</strong>를
                      누르면 위 입력칸에 URL이 자동으로 들어갑니다. 저장은 맨 아래 「①② 저장」으로 합니다.
                    </p>
                    {trainingCandidatesError ? (
                      <p className="mt-1.5 text-[10px] text-red-300/95">{trainingCandidatesError}</p>
                    ) : null}
                    {trainingCandidatesLoading ? (
                      <p className="mt-1.5 text-[10px] text-amber-200/60">후보 불러오는 중…</p>
                    ) : trainingCandidates.length === 0 ? (
                      <p className="mt-1.5 text-[10px] text-amber-200/55">
                        아직 국외연수 후보가 없습니다. 이 페이지 위쪽에서 후보를 생성하면 여기에 나타납니다.
                      </p>
                    ) : (
                      <ul className="mt-2 flex max-w-full gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-gutter:stable]">
                        {trainingCandidates.map((c) => {
                          const path = c.imagePath.trim()
                          const d1 = (manualDraft.training ?? '').trim()
                          const d2 = trainingSecondaryDraft.trim()
                          const onPrimary = Boolean(path) && d1 === path
                          const onSecondary = Boolean(path) && d2 === path
                          const ring =
                            onPrimary && onSecondary
                              ? 'ring-2 ring-amber-300 ring-offset-1 ring-offset-slate-950'
                              : onPrimary
                                ? 'ring-2 ring-teal-400 ring-offset-1 ring-offset-slate-950'
                                : onSecondary
                                  ? 'ring-2 ring-violet-400 ring-offset-1 ring-offset-slate-950'
                                  : 'ring-1 ring-slate-700/80'

                          return (
                            <li
                              key={c.id}
                              className={`w-[88px] flex-shrink-0 overflow-hidden rounded-md bg-slate-900/80 ${ring}`}
                            >
                              <div className="relative aspect-video w-full bg-slate-800">
                                <Image
                                  src={c.imagePath}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  sizes="96px"
                                  unoptimized={c.imagePath.startsWith('http')}
                                />
                              </div>
                              <div className="flex gap-0.5 border-t border-slate-800/90 p-0.5">
                                <button
                                  type="button"
                                  title="① 메인·상단에 이 URL 넣기"
                                  onClick={() =>
                                    setManualDraft((p) => ({
                                      ...p,
                                      training: path,
                                    }))
                                  }
                                  className="flex-1 rounded bg-slate-800 py-1 text-[10px] font-bold text-teal-200 hover:bg-slate-700"
                                >
                                  ①
                                </button>
                                <button
                                  type="button"
                                  title="② 통역 블록에 이 URL 넣기"
                                  onClick={() => setTrainingSecondaryDraft(path)}
                                  className="flex-1 rounded bg-slate-800 py-1 text-[10px] font-bold text-violet-200 hover:bg-slate-700"
                                >
                                  ②
                                </button>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                <span className="text-sm font-semibold text-slate-100">{cardLabels[key]}</span>
                <span
                  className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClass(detail.tier)}`}
                >
                  {detail.tier === 'manual' ? '수동' : detail.tier === 'product_pool' ? '상품 풀' : '정적'}
                </span>
              </div>
              <div className="relative mt-2 aspect-[16/9] w-full overflow-hidden rounded-md bg-slate-800">
                <Image
                  src={detail.url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width:1024px) 100vw, 50vw"
                  unoptimized={detail.url.startsWith('http')}
                />
                <div className="absolute bottom-1 left-1 right-1 rounded bg-slate-950/88 px-2 py-1 text-[10px] leading-snug text-slate-300">
                  {detail.explanationShort}
                </div>
              </div>
              <dl className="mt-2 space-y-1 text-[11px] text-slate-400">
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <dt className="text-slate-500">설정 모드</dt>
                  <dd className="font-mono text-teal-200/90">{modeVal}</dd>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <dt className="text-slate-500">상품 풀</dt>
                  <dd>{poolSupported ? '대상 카드 (해외·국내)' : '미사용 (연수·버스는 manual 기본)'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">
                    {key === 'training' ? '① 메인 허브 + /training 상단 (images.training)' : '수동 이미지 URL (JSON images)'}
                  </dt>
                  {key === 'training' ? (
                    <dd className="mb-1 text-[10px] leading-snug text-slate-500">
                      위 후보 썸네일의 ①·②로 자동 입력하거나, 필요하면 여기서 직접 수정합니다.
                    </dd>
                  ) : null}
                  <dd className="mt-0.5">
                    <textarea
                      rows={2}
                      value={manualDraft[key] ?? ''}
                      onChange={(e) => setManualDraft((p) => ({ ...p, [key]: e.target.value }))}
                      className="w-full resize-y rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-[10px] text-teal-100/90 placeholder:text-slate-600"
                      placeholder="/images/... 또는 https://... (비우면 수동 미지정)"
                    />
                  </dd>
                </div>
                {key === 'training' ? (
                  <div>
                    <dt className="text-slate-500">② /training 만 — 통역·운영 절 왼쪽 큰 사진</dt>
                    <dd className="mb-1 text-[10px] leading-snug text-slate-500">
                      JSON 필드 <code className="text-slate-400">trainingPageSecondaryImage</code>에 저장됩니다. ①과
                      다르게 넣으면 두 장이 고정됩니다.
                    </dd>
                    <dd className="mt-0.5">
                      <textarea
                        rows={2}
                        value={trainingSecondaryDraft}
                        onChange={(e) => setTrainingSecondaryDraft(e.target.value)}
                        className="w-full resize-y rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-[10px] text-teal-100/90 placeholder:text-slate-600"
                        placeholder="② 전용 URL (비우면 ①과 동일)"
                      />
                    </dd>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-slate-500">모드</span>
                  {poolSupported ? (
                    <select
                      value={modeVal}
                      onChange={(e) =>
                        setModeDraft((p) => ({
                          ...p,
                          [key]: e.target.value as HomeHubCardImageSourceMode,
                        }))
                      }
                      className="rounded border border-slate-600 bg-slate-950 px-2 py-1 font-mono text-[11px] text-slate-200"
                    >
                      <option value="product_pool">product_pool (등록 상품 풀)</option>
                      <option value="manual">manual (수동·정적만)</option>
                    </select>
                  ) : (
                    <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-400">
                      manual (고정)
                    </span>
                  )}
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveCard(key)}
                  className="rounded-lg border border-teal-600/80 bg-teal-950/50 px-3 py-1.5 text-xs font-semibold text-teal-100 hover:bg-teal-900/50 disabled:opacity-50"
                >
                  {busy ? '저장 중…' : key === 'training' ? '①② 저장 (이 카드)' : '이 카드 저장'}
                </button>
                {poolSupported ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void clearManualAndSave(key)}
                    className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    수동 비우기 + 풀 사용
                  </button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
