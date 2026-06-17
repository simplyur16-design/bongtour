'use client'

import { useState } from 'react'
import ProductSearchInput, {
  type ProductSearchItem,
} from '@/components/admin/marketing/card-news/ProductSearchInput'

export type EpisodeFormValues = {
  title: string
  episodeType: 'package' | 'tip' | 'caution'
  formatType: 'deep' | 'list'
  targetCity: string
  targetPlace: string
  operatorNote: string
  linkedProductId: string | null
}

type Props = {
  open: boolean
  title: string
  cityOptions: string[]
  initial?: Partial<EpisodeFormValues> & { linkedProduct?: ProductSearchItem | null }
  submitLabel: string
  onClose: () => void
  onSubmit: (values: EpisodeFormValues) => Promise<void>
}

export default function EpisodeForm({
  open,
  title,
  cityOptions,
  initial,
  submitLabel,
  onClose,
  onSubmit,
}: Props) {
  const [episodeTitle, setEpisodeTitle] = useState(initial?.title ?? '')
  const [episodeType, setEpisodeType] = useState<'package' | 'tip' | 'caution'>(
    initial?.episodeType ?? 'package',
  )
  const [formatType, setFormatType] = useState<'deep' | 'list'>(initial?.formatType ?? 'deep')
  const [targetCity, setTargetCity] = useState(initial?.targetCity ?? '')
  const [targetPlace, setTargetPlace] = useState(initial?.targetPlace ?? '')
  const [operatorNote, setOperatorNote] = useState(initial?.operatorNote ?? '')
  const [product, setProduct] = useState<ProductSearchItem | null>(initial?.linkedProduct ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSubmit({
        title: episodeTitle.trim(),
        episodeType,
        formatType,
        targetCity: targetCity.trim(),
        targetPlace: formatType === 'deep' ? targetPlace.trim() : '',
        operatorNote: operatorNote.trim(),
        linkedProductId: product?.id ?? null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-bt-title">{title}</h2>
        {error && (
          <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <label className="block text-sm">
            편 제목
            <input
              value={episodeTitle}
              onChange={(e) => setEpisodeTitle(e.target.value)}
              className="mt-1 w-full rounded border border-bt-border-strong px-3 py-2"
              required
            />
          </label>

          <fieldset>
            <legend className="text-sm text-bt-body/80">편 타입</legend>
            <div className="mt-2 flex gap-4 text-sm">
              {(['package', 'tip', 'caution'] as const).map((t) => (
                <label key={t} className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    checked={episodeType === t}
                    onChange={() => setEpisodeType(t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center justify-between text-sm">
            <span>포맷: {formatType === 'deep' ? 'Deep' : 'List'}</span>
            <button
              type="button"
              onClick={() => setFormatType((f) => (f === 'deep' ? 'list' : 'deep'))}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                formatType === 'list' ? 'bg-bt-brand-blue' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  formatType === 'list' ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </label>

          <label className="block text-sm">
            대상 도시
            <select
              value={targetCity}
              onChange={(e) => setTargetCity(e.target.value)}
              className="mt-1 w-full rounded border border-bt-border-strong px-3 py-2"
            >
              <option value="">선택</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {formatType === 'deep' && (
            <label className="block text-sm">
              대상 명소
              <input
                value={targetPlace}
                onChange={(e) => setTargetPlace(e.target.value)}
                className="mt-1 w-full rounded border border-bt-border-strong px-3 py-2"
              />
            </label>
          )}

          <div>
            <p className="text-sm text-bt-body/80">연결 상품</p>
            <div className="mt-1">
              <ProductSearchInput value={product} onChange={setProduct} />
            </div>
          </div>

          <label className="block text-sm">
            편 메모
            <textarea
              value={operatorNote}
              onChange={(e) => setOperatorNote(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-bt-border-strong px-3 py-2"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
              취소
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-bt-brand-blue px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? '저장 중…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
