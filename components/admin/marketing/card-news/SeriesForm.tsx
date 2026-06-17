'use client'

import { useState } from 'react'
import CitiesEditor from '@/components/admin/marketing/card-news/CitiesEditor'
import { CARD_NEWS_SEASONS, isoWeekKey } from '@/lib/bong-marketing/card-news-admin-constants'

export type SeriesFormValues = {
  weekKey: string
  themeTitle: string
  tripNights: number
  tripDays: number
  season: string
  operatorNote: string
  selectedCities: string[]
}

type Props = {
  initial?: Partial<SeriesFormValues>
  seriesId?: string
  submitLabel: string
  onSubmit: (values: SeriesFormValues) => Promise<void>
  /** recommend 호출 전 시리즈 id 확보(신규 페이지: POST/PATCH) */
  beforeRecommend?: (values: SeriesFormValues) => Promise<string>
  onRecommendCities?: (seriesId: string) => Promise<string[]>
}

export default function SeriesForm({
  initial,
  seriesId,
  submitLabel,
  onSubmit,
  beforeRecommend,
  onRecommendCities,
}: Props) {
  const [weekKey, setWeekKey] = useState(initial?.weekKey ?? isoWeekKey())
  const [themeTitle, setThemeTitle] = useState(initial?.themeTitle ?? '')
  const [tripNights, setTripNights] = useState(initial?.tripNights ?? 4)
  const [tripDays, setTripDays] = useState(initial?.tripDays ?? 5)
  const [season, setSeason] = useState(initial?.season ?? '')
  const [operatorNote, setOperatorNote] = useState(initial?.operatorNote ?? '')
  const [selectedCities, setSelectedCities] = useState<string[]>(initial?.selectedCities ?? [])
  const [busy, setBusy] = useState(false)
  const [recommendBusy, setRecommendBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleRecommend() {
    if (!onRecommendCities) return
    setRecommendBusy(true)
    setError('')
    try {
      const values: SeriesFormValues = {
        weekKey: weekKey.trim(),
        themeTitle: themeTitle.trim(),
        tripNights,
        tripDays,
        season,
        operatorNote: operatorNote.trim(),
        selectedCities,
      }
      const id = seriesId ?? (beforeRecommend ? await beforeRecommend(values) : null)
      if (!id) {
        setError('도시 추천을 위해 시리즈를 먼저 저장할 수 없습니다.')
        return
      }
      const cities = await onRecommendCities(id)
      setSelectedCities(cities)
    } catch (e) {
      setError(e instanceof Error ? e.message : '도시 추천 실패')
    } finally {
      setRecommendBusy(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSubmit({
        weekKey: weekKey.trim(),
        themeTitle: themeTitle.trim(),
        tripNights,
        tripDays,
        season,
        operatorNote: operatorNote.trim(),
        selectedCities,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mx-auto max-w-2xl space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <label className="block text-sm">
        <span className="text-bt-body/80">주차 (YYYY-Www)</span>
        <input
          value={weekKey}
          onChange={(e) => setWeekKey(e.target.value)}
          className="mt-1 w-full rounded border border-bt-border-strong px-3 py-2"
          required
        />
      </label>

      <label className="block text-sm">
        <span className="text-bt-body/80">시리즈 테마</span>
        <input
          value={themeTitle}
          onChange={(e) => setThemeTitle(e.target.value)}
          placeholder="여름 일본 인기 도시"
          className="mt-1 w-full rounded border border-bt-border-strong px-3 py-2"
          required
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="text-bt-body/80">박</span>
          <input
            type="number"
            min={1}
            value={tripNights}
            onChange={(e) => setTripNights(parseInt(e.target.value, 10) || 0)}
            className="mt-1 w-full rounded border border-bt-border-strong px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-bt-body/80">일</span>
          <input
            type="number"
            min={2}
            value={tripDays}
            onChange={(e) => setTripDays(parseInt(e.target.value, 10) || 0)}
            className="mt-1 w-full rounded border border-bt-border-strong px-3 py-2"
            required
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-bt-body/80">시즌</span>
        <select
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          className="mt-1 w-full rounded border border-bt-border-strong px-3 py-2"
        >
          {CARD_NEWS_SEASONS.map((s) => (
            <option key={s.value || 'none'} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-bt-body/80">운영자 메모 (선택)</span>
        <textarea
          value={operatorNote}
          onChange={(e) => setOperatorNote(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded border border-bt-border-strong px-3 py-2"
        />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm text-bt-body/80">선택 도시</span>
          {onRecommendCities && (
            <button
              type="button"
              disabled={recommendBusy || !themeTitle.trim()}
              onClick={() => void handleRecommend()}
              className="rounded-lg border border-bt-border-strong px-3 py-1.5 text-sm hover:bg-bt-surface-soft disabled:opacity-50"
            >
              {recommendBusy ? '추천 중…' : '도시 자동 추천'}
            </button>
          )}
        </div>
        <CitiesEditor cities={selectedCities} onChange={setSelectedCities} />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-bt-brand-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? '저장 중…' : submitLabel}
      </button>
    </form>
  )
}
