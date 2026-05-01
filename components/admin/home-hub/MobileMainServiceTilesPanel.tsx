'use client'

import { useCallback, useEffect, useState } from 'react'
import type { HomeHubActiveClientModel } from '@/lib/home-hub-active-client-model'
import type { HomeHubActiveFile, MobileMainServiceTileKey } from '@/lib/home-hub-resolve-images'
import { MobileTileStoragePickerModal } from '@/components/admin/home-hub/MobileTileStoragePickerModal'
import SafeImage from '@/app/components/SafeImage'

const ROWS: { key: MobileMainServiceTileKey; title: string; hint: string; imageGuide: string }[] = [
  {
    key: 'overseas',
    title: '해외여행',
    hint: '모바일 홈「주요 서비스」그리드 1칸',
    imageGuide: '권장 컷: 영국·프랑스 등 유럽 느낌(도시 스카이라인·랜드마크 등).',
  },
  {
    key: 'airHotel',
    title: '항공+호텔',
    hint: '에어텔·자유여행',
    imageGuide: '권장 컷: 이륙·상승 중인 여객기, 공항 활주로 풍경.',
  },
  {
    key: 'privateTrip',
    title: '우리끼리',
    hint: '맞춤·소규모',
    imageGuide: '권장 컷: 가족·소그룹이 함께하는 여행 사진(얼굴·초상권 동의된 컷).',
  },
  {
    key: 'training',
    title: '국외연수',
    hint: '학교·기업·공공',
    imageGuide: '권장 컷: 회의장·세미나룸·연수 진행 장면.',
  },
]

type Props = {
  active: HomeHubActiveClientModel | null
  onSaved: (file: HomeHubActiveFile) => void
  onSaveError: (message: string) => void
}

function emptyDraft(): Record<MobileMainServiceTileKey, string> {
  return { overseas: '', airHotel: '', privateTrip: '', training: '' }
}

function isLikelyImageUrl(s: string): boolean {
  const t = s.trim().toLowerCase()
  if (!t) return false
  if (t.startsWith('/images/')) return true
  return /^https?:\/\//i.test(t) && /\.(webp|png|jpe?g|gif|avif)(\?|$)/i.test(t)
}

export function MobileMainServiceTilesPanel({ active, onSaved, onSaveError }: Props) {
  const [draft, setDraft] = useState(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [pickerKey, setPickerKey] = useState<MobileMainServiceTileKey | null>(null)

  useEffect(() => {
    const m = active?.mobileMainServiceTiles
    setDraft({
      overseas: m?.overseas?.trim() ?? '',
      airHotel: m?.airHotel?.trim() ?? '',
      privateTrip: m?.privateTrip?.trim() ?? '',
      training: m?.training?.trim() ?? '',
    })
  }, [active?.lastUpdatedAt, active?.mobileMainServiceTiles])

  const setField = useCallback((key: MobileMainServiceTileKey, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/home-hub-card-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileMainServiceTiles: draft }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; active?: HomeHubActiveFile }
      if (!res.ok || !data.ok || !data.active) {
        onSaveError(data.error ?? '모바일 타일 URL 저장에 실패했습니다.')
        return
      }
      onSaved(data.active)
    } catch {
      onSaveError('네트워크 오류로 저장하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }, [draft, onSaveError, onSaved])

  const pickerTitle = pickerKey ? ROWS.find((r) => r.key === pickerKey)?.title ?? pickerKey : ''

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">모바일 홈 · 주요 서비스 4칸 배경</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        기본은 <strong className="font-semibold text-slate-800">Supabase에서 선택</strong>으로 공개 이미지를 고릅니다. 저장값은 기존과 동일하게{' '}
        <code className="rounded bg-slate-100 px-1 text-xs">https://…</code> 공개 URL(또는 <code className="rounded bg-slate-100 px-1 text-xs">/images/…</code>
        )입니다. 예외 시에만 아래「직접 URL 입력」을 펼쳐 붙여넣기 하세요.
      </p>
      <ul className="mt-4 space-y-6">
        {ROWS.map((row) => {
          const url = draft[row.key]
          const showPreview = isLikelyImageUrl(url)
          return (
            <li
              key={row.key}
              className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 shadow-sm ring-1 ring-slate-100/80"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="shrink-0 sm:w-44">
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
                    {showPreview ? (
                      <SafeImage
                        src={url.trim()}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 200px"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full min-h-[5.5rem] items-center justify-center px-2 text-center text-xs text-slate-500">
                        미리보기 없음
                      </div>
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {row.title}
                      <span className="ml-2 font-normal text-slate-500">({row.hint})</span>
                    </p>
                    <p className="mt-1 text-xs leading-snug text-slate-600">{row.imageGuide}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPickerKey(row.key)}
                      className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-teal-800"
                    >
                      Supabase에서 선택
                    </button>
                    <button
                      type="button"
                      onClick={() => setField(row.key, '')}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                    >
                      초기화
                    </button>
                  </div>
                  <details className="group rounded-lg border border-slate-200 bg-white">
                    <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-teal-800 marker:content-none [&::-webkit-details-marker]:hidden">
                      <span className="underline-offset-2 group-open:underline">직접 URL 입력</span>
                      <span className="ml-2 text-xs font-normal text-slate-500">(보조)</span>
                    </summary>
                    <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                      <input
                        type="text"
                        name={`mobile-tile-${row.key}`}
                        value={draft[row.key]}
                        onChange={(e) => setField(row.key, e.target.value)}
                        placeholder="https://… 또는 /images/… (비우면 그라데이션만)"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                        autoComplete="off"
                      />
                    </div>
                  </details>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-teal-800 disabled:opacity-60"
        >
          {saving ? '저장 중…' : '모바일 타일 URL 저장'}
        </button>
      </div>

      <MobileTileStoragePickerModal
        open={pickerKey !== null}
        tileKey={pickerKey}
        tileTitle={pickerTitle}
        onClose={() => setPickerKey(null)}
        onConfirm={(publicUrl) => {
          if (pickerKey) setField(pickerKey, publicUrl)
        }}
      />
    </section>
  )
}
