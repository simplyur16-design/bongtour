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

const KEYS: HomeHubCardImageKey[] = ['overseas', 'training', 'domestic', 'bus']

export type TravelPoolPreview = { overseas: string | null; domestic: string | null }

type Props = {
  cardLabels: Record<HomeHubCardImageKey, string>
  active: HomeHubActiveClientModel | null
  initialTravelPool: TravelPoolPreview
  onSaved: (active: HomeHubActiveFile) => void
  onSaveError?: (message: string) => void
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
}: Props) {
  const [poolPreview, setPoolPreview] = useState<TravelPoolPreview>(initialTravelPool)
  const [modeDraft, setModeDraft] = useState<Partial<Record<HomeHubCardImageKey, HomeHubCardImageSourceMode>>>({})
  const [manualDraft, setManualDraft] = useState<Partial<Record<HomeHubCardImageKey, string>>>({})
  const [savingKey, setSavingKey] = useState<HomeHubCardImageKey | null>(null)
  const [poolBusy, setPoolBusy] = useState(false)

  useEffect(() => {
    setPoolPreview(initialTravelPool)
  }, [initialTravelPool])

  const syncDraftsFromActive = useCallback(() => {
    if (!active) {
      setModeDraft({})
      setManualDraft({})
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
  }, [active])

  useEffect(() => {
    syncDraftsFromActive()
  }, [syncDraftsFromActive])

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
    async (key: HomeHubCardImageKey, body: { imageSourceModes?: Record<string, string>; images?: Record<string, string> }) => {
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
    await patchCard(key, {
      imageSourceModes: { [key]: mode },
      images: { [key]: manual },
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
                  <dt className="text-slate-500">수동 이미지 URL (JSON images)</dt>
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
                  {busy ? '저장 중…' : '이 카드 저장'}
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
