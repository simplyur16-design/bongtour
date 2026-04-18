'use client'

import { useCallback, useEffect, useState } from 'react'
import type { HomeHubActiveClientModel } from '@/lib/home-hub-active-client-model'
import type { HomeHubActiveFile, MobileMainServiceTileKey } from '@/lib/home-hub-resolve-images'

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

export function MobileMainServiceTilesPanel({ active, onSaved, onSaveError }: Props) {
  const [draft, setDraft] = useState(emptyDraft)
  const [saving, setSaving] = useState(false)

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

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">모바일 홈 · 주요 서비스 4칸 배경</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        비워 두면 사진 없이 톤 그라데이션만 표시됩니다. 여행사 메인이라 너무 가볍거나 무거운 스톡보다는 아래「권장 컷」에 맞는 이미지를 올리는 것을 권합니다. Supabase 스토리지 등 공개 URL(
        <code className="rounded bg-slate-100 px-1 text-xs">https://</code>
        ) 또는 <code className="rounded bg-slate-100 px-1 text-xs">/images/...</code> 경로를 넣으세요.
      </p>
      <ul className="mt-4 space-y-4">
        {ROWS.map((row) => (
          <li key={row.key}>
            <label className="block text-sm font-semibold text-slate-800">
              {row.title}
              <span className="ml-2 font-normal text-slate-500">({row.hint})</span>
            </label>
            <p className="mt-1 text-xs leading-snug text-slate-600">{row.imageGuide}</p>
            <input
              type="text"
              name={`mobile-tile-${row.key}`}
              value={draft[row.key]}
              onChange={(e) => setField(row.key, e.target.value)}
              placeholder="비우면 그라데이션만"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              autoComplete="off"
            />
          </li>
        ))}
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
    </section>
  )
}
