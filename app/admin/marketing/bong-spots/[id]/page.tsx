'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

const STATUS_OPTIONS = ['draft', 'approved', 'published'] as const

const MONTH_LABELS = [
  '1월',
  '2월',
  '3월',
  '4월',
  '5월',
  '6월',
  '7월',
  '8월',
  '9월',
  '10월',
  '11월',
  '12월',
]

type SeasonalNote = {
  id: string
  month: number
  title: string | null
  body: string | null
  status: string
}

type SpotDetail = {
  id: string
  title: string
  slug: string | null
  summary: string | null
  body: string | null
  country: string | null
  city: string | null
  countryKey: string | null
  cityKey: string | null
  heroImageUrl: string | null
  status: string
}

export default function AdminBongSpotEditPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params?.id === 'string' ? params.id : ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [spot, setSpot] = useState<SpotDetail | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [notesByMonth, setNotesByMonth] = useState<Record<number, SeasonalNote | undefined>>({})
  const [seasonBusy, setSeasonBusy] = useState<number | null>(null)

  const loadSpot = useCallback(async () => {
    if (!id) return
    const res = await fetch(`/api/admin/marketing/bong-spots/${id}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '조회 실패')
    setSpot(data as SpotDetail)
  }, [id])

  const loadNotes = useCallback(async () => {
    if (!id) return
    const res = await fetch(`/api/admin/marketing/bong-spots/${id}/seasonal-notes`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '시즌 노트 조회 실패')
    const map: Record<number, SeasonalNote | undefined> = {}
    for (const row of (data.items ?? []) as SeasonalNote[]) {
      map[row.month] = row
    }
    setNotesByMonth(map)
  }, [id])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        await loadSpot()
        await loadNotes()
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '불러오기 실패')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, loadSpot, loadNotes])

  const saveSpot = async () => {
    if (!spot) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/marketing/bong-spots/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: spot.title,
          slug: spot.slug,
          summary: spot.summary,
          body: spot.body,
          country: spot.country,
          city: spot.city,
          countryKey: spot.countryKey,
          cityKey: spot.cityKey,
          heroImageUrl: spot.heroImageUrl,
          status: spot.status,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      setSpot(data as SpotDetail)
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const removeSpot = async () => {
    if (!confirm('이 봉 스팟과 연결된 시즌 노트·상품 연동이 함께 삭제될 수 있습니다. 삭제할까요?')) return
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/marketing/bong-spots/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '삭제 실패')
      router.push('/admin/marketing/bong-spots')
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setDeleting(false)
    }
  }

  const upsertMonth = async (month: number, payload: { title?: string; body?: string; status?: string }) => {
    setSeasonBusy(month)
    setError('')
    try {
      const existing = notesByMonth[month]
      if (existing) {
        const res = await fetch(`/api/admin/marketing/bong-spots/${id}/seasonal-notes/${month}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? '저장 실패')
        setNotesByMonth((m) => ({ ...m, [month]: data as SeasonalNote }))
      } else {
        const res = await fetch(`/api/admin/marketing/bong-spots/${id}/seasonal-notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month, ...payload }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? '추가 실패')
        setNotesByMonth((m) => ({ ...m, [month]: data as SeasonalNote }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '시즌 노트 처리 실패')
    } finally {
      setSeasonBusy(null)
    }
  }

  const deleteMonth = async (month: number) => {
    if (!notesByMonth[month]) return
    if (!confirm(`${month}월 노트를 삭제할까요?`)) return
    setSeasonBusy(month)
    setError('')
    try {
      const res = await fetch(`/api/admin/marketing/bong-spots/${id}/seasonal-notes/${month}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '삭제 실패')
      setNotesByMonth((m) => {
        const next = { ...m }
        delete next[month]
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setSeasonBusy(null)
    }
  }

  if (!id) {
    return <p className="text-sm text-red-600">잘못된 경로입니다.</p>
  }

  if (loading || !spot) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center text-bt-body/70">
        {error ? <p className="text-red-600">{error}</p> : '불러오는 중…'}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/marketing/bong-spots" className="text-sm text-bt-brand-blue hover:underline">
          ← 목록
        </Link>
        <button
          type="button"
          disabled={deleting}
          onClick={() => void removeSpot()}
          className="text-sm text-red-600 hover:underline disabled:opacity-50"
        >
          삭제
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <h1 className="text-xl font-semibold text-bt-title">봉 스팟 편집</h1>

      <section className="space-y-3 rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-bt-title">위치</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Inp label="국가" v={spot.country} onChange={(v) => setSpot({ ...spot, country: v })} />
          <Inp label="도시" v={spot.city} onChange={(v) => setSpot({ ...spot, city: v })} />
          <Inp label="countryKey" v={spot.countryKey} onChange={(v) => setSpot({ ...spot, countryKey: v })} />
          <Inp label="cityKey" v={spot.cityKey} onChange={(v) => setSpot({ ...spot, cityKey: v })} />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-bt-title">식별</h2>
        <Inp label="제목" v={spot.title} onChange={(v) => setSpot({ ...spot, title: v })} />
        <Inp label="slug" v={spot.slug} onChange={(v) => setSpot({ ...spot, slug: v })} />
      </section>

      <section className="space-y-3 rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-bt-title">콘텐츠</h2>
        <label className="block text-xs text-bt-body/80">
          요약
          <textarea
            value={spot.summary ?? ''}
            onChange={(e) => setSpot({ ...spot, summary: e.target.value })}
            rows={2}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs text-bt-body/80">
          본문
          <textarea
            value={spot.body ?? ''}
            onChange={(e) => setSpot({ ...spot, body: e.target.value })}
            rows={8}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
      </section>

      <section className="space-y-3 rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-bt-title">이미지</h2>
        <Inp label="heroImageUrl" v={spot.heroImageUrl} onChange={(v) => setSpot({ ...spot, heroImageUrl: v })} />
        <p className="text-xs text-bt-body/60">
          <Link href="/admin/image-assets-upload" className="text-bt-brand-blue hover:underline">
            이미지 업로드
          </Link>
        </p>
      </section>

      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
        <label className="text-sm">
          상태{' '}
          <select
            value={spot.status}
            onChange={(e) => setSpot({ ...spot, status: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveSpot()}
          className="rounded-lg bg-bt-brand-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? '저장 중…' : '본문 저장'}
        </button>
      </section>

      <section className="space-y-4 rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-bt-title">봉 시즌 · 봉 리즌 (월별)</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MONTH_LABELS.map((label, idx) => {
            const month = idx + 1
            const note = notesByMonth[month]
            return (
              <MonthCard
                key={month}
                label={label}
                month={month}
                note={note}
                busy={seasonBusy === month}
                onSave={(payload) => void upsertMonth(month, payload)}
                onDelete={() => void deleteMonth(month)}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Inp({
  label,
  v,
  onChange,
}: {
  label: string
  v: string | null
  onChange: (v: string) => void
}) {
  return (
    <label className="block text-xs text-bt-body/80">
      {label}
      <input
        value={v ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
      />
    </label>
  )
}

function MonthCard({
  label,
  month,
  note,
  busy,
  onSave,
  onDelete,
}: {
  label: string
  month: number
  note: SeasonalNote | undefined
  busy: boolean
  onSave: (p: { title?: string; body?: string; status?: string }) => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const [status, setStatus] = useState(note?.status ?? 'draft')

  useEffect(() => {
    setTitle(note?.title ?? '')
    setBody(note?.body ?? '')
    setStatus(note?.status ?? 'draft')
  }, [note])

  return (
    <div className="flex flex-col rounded border border-gray-200 p-3 text-sm">
      <div className="mb-2 font-medium text-bt-title">{label}</div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        className="mb-1 rounded border border-gray-200 px-2 py-1 text-xs"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="본문"
        rows={3}
        className="mb-2 rounded border border-gray-200 px-2 py-1 text-xs"
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="mb-2 rounded border border-gray-200 px-2 py-1 text-xs"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <div className="mt-auto flex flex-wrap gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave({ title, body, status })}
          className="rounded bg-gray-800 px-2 py-1 text-xs text-white disabled:opacity-50"
        >
          {note ? '저장' : '추가'}
        </button>
        {note && (
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
          >
            삭제
          </button>
        )}
      </div>
    </div>
  )
}
