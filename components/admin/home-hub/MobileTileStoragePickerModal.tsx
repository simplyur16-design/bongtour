'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import SafeImage from '@/app/components/SafeImage'
import type { MobileMainServiceTileKey } from '@/lib/home-hub-resolve-images'

export const STORAGE_IMAGE_PICKER_PREFIX_OPTIONS: { value: string; label: string }[] = [
  { value: 'photo-pool', label: 'photo-pool' },
  { value: 'monthly-curation', label: 'monthly-curation' },
  { value: 'editorial-content', label: 'editorial-content' },
  { value: 'home-hub/candidates', label: 'home-hub/candidates' },
  { value: 'home-hub', label: 'home-hub (하위 전체)' },
  { value: 'gemini/generated', label: 'gemini/generated' },
]

type PickerItem = { objectKey: string; publicUrl: string; updated_at: string | null }

type Props = {
  open: boolean
  tileKey: MobileMainServiceTileKey | null
  tileTitle: string
  onClose: () => void
  onConfirm: (publicUrl: string) => void
}

export function MobileTileStoragePickerModal({ open, tileKey, tileTitle, onClose, onConfirm }: Props) {
  const [prefix, setPrefix] = useState(STORAGE_IMAGE_PICKER_PREFIX_OPTIONS[0]!.value)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<PickerItem[]>([])
  const [truncated, setTruncated] = useState(false)
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
  const [storageOff, setStorageOff] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({ prefix, limit: '800' })
      const res = await fetch(`/api/admin/storage-image-picker?${q}`)
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        items?: PickerItem[]
        truncated?: boolean
      }
      if (res.status === 503) {
        setStorageOff(true)
        setItems([])
        setError(data.error ?? 'Supabase Storage가 설정되지 않았습니다.')
        return
      }
      if (!res.ok || !data.ok) {
        setItems([])
        setError(data.error ?? '목록을 불러오지 못했습니다.')
        return
      }
      setStorageOff(false)
      setItems(Array.isArray(data.items) ? data.items : [])
      setTruncated(Boolean(data.truncated))
      setSelectedUrl(null)
    } catch {
      setError('네트워크 오류로 목록을 불러오지 못했습니다.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [prefix])

  useEffect(() => {
    if (!open || !tileKey) return
    void load()
  }, [open, tileKey, load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => it.objectKey.toLowerCase().includes(q) || it.publicUrl.toLowerCase().includes(q))
  }, [items, search])

  const handleConfirm = useCallback(() => {
    if (!selectedUrl) return
    onConfirm(selectedUrl)
    onClose()
  }, [onConfirm, onClose, selectedUrl])

  if (!open || !tileKey) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-tile-picker-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="flex max-h-[min(92vh,720px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div>
            <h3 id="mobile-tile-picker-title" className="text-base font-bold text-slate-900">
              Supabase에서 선택
            </h3>
            <p className="mt-0.5 text-sm text-slate-600">
              적용 칸: <span className="font-semibold text-teal-800">{tileTitle}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            닫기
          </button>
        </div>

        <div className="shrink-0 space-y-2 border-b border-slate-100 px-4 py-3 sm:px-5">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">폴더(prefix)</label>
          <select
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            {STORAGE_IMAGE_PICKER_PREFIX_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">경로·파일명 검색</label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="예: da-nang, hero, webp"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void load()}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
            >
              {loading ? '불러오는 중…' : '새로고침'}
            </button>
            {truncated ? (
              <span className="text-xs text-amber-800">일부만 불러왔습니다. 폴더를 좁히거나 검색을 사용하세요.</span>
            ) : null}
            {!loading && !error && items.length > 0 ? (
              <span className="text-xs text-slate-500">
                {filtered.length}/{items.length}건 표시
              </span>
            ) : null}
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {storageOff ? (
            <p className="text-xs text-slate-600">운영 서버에 Supabase 키가 있으면 여기서 바로 고를 수 있습니다.</p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {loading && items.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">목록을 불러오는 중입니다…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">표시할 이미지가 없습니다. 다른 폴더를 선택해 보세요.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {filtered.map((it) => {
                const active = selectedUrl === it.publicUrl
                return (
                  <li key={it.publicUrl}>
                    <button
                      type="button"
                      onClick={() => setSelectedUrl(it.publicUrl)}
                      className={`w-full overflow-hidden rounded-xl border-2 bg-slate-50 text-left transition ${
                        active
                          ? 'border-teal-600 ring-2 ring-teal-500/30'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="relative aspect-[4/3] w-full bg-slate-200">
                        <SafeImage
                          src={it.publicUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 45vw, 200px"
                          loading="lazy"
                        />
                      </div>
                      <p className="line-clamp-2 px-2 py-1.5 font-mono text-[10px] leading-tight text-slate-700">
                        {it.objectKey}
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!selectedUrl}
            onClick={handleConfirm}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-teal-800 disabled:opacity-50"
          >
            이 이미지 적용
          </button>
        </div>
      </div>
    </div>
  )
}
