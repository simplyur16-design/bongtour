'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

const STATUS_OPTIONS = ['draft', 'approved', 'published'] as const

type Food = {
  id: string
  name: string
  description: string | null
  category: string | null
  country: string | null
  city: string | null
  countryKey: string | null
  cityKey: string | null
  status: string
}

export default function AdminBongFoodEditPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params?.id === 'string' ? params.id : ''
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [row, setRow] = useState<Food | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/marketing/bong-foods/${id}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '조회 실패')
    setRow(data as Food)
  }, [id])

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : '불러오기 실패')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, load])

  const save = async () => {
    if (!row) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/marketing/bong-foods/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: row.name,
          description: row.description,
          category: row.category,
          country: row.country,
          city: row.city,
          countryKey: row.countryKey,
          cityKey: row.cityKey,
          status: row.status,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      setRow(data as Food)
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!confirm('삭제할까요?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/marketing/bong-foods/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '삭제 실패')
      router.push('/admin/marketing/bong-foods')
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setDeleting(false)
    }
  }

  if (!id) return <p className="text-sm text-red-600">잘못된 경로</p>
  if (loading || !row) {
    return <div className="py-12 text-center text-bt-body/70">{error || '불러오는 중…'}</div>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex justify-between">
        <Link href="/admin/marketing/bong-foods" className="text-sm text-bt-brand-blue hover:underline">
          ← 목록
        </Link>
        <button type="button" disabled={deleting} onClick={() => void remove()} className="text-sm text-red-600">
          삭제
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <h1 className="text-xl font-semibold">봉 푸드 편집</h1>
      <div className="grid gap-3 rounded-lg border border-bt-border-strong bg-white p-4 sm:grid-cols-2">
        <F label="이름" v={row.name} onChange={(v) => setRow({ ...row, name: v })} />
        <F label="카테고리" v={row.category} onChange={(v) => setRow({ ...row, category: v })} />
        <F label="국가" v={row.country} onChange={(v) => setRow({ ...row, country: v })} />
        <F label="도시" v={row.city} onChange={(v) => setRow({ ...row, city: v })} />
        <F label="countryKey" v={row.countryKey} onChange={(v) => setRow({ ...row, countryKey: v })} />
        <F label="cityKey" v={row.cityKey} onChange={(v) => setRow({ ...row, cityKey: v })} />
      </div>
      <label className="block text-xs">
        설명
        <textarea
          value={row.description ?? ''}
          onChange={(e) => setRow({ ...row, description: e.target.value })}
          rows={6}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="text-sm">
        상태{' '}
        <select
          value={row.status}
          onChange={(e) => setRow({ ...row, status: e.target.value })}
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
        onClick={() => void save()}
        className="rounded-lg bg-bt-brand-blue px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {saving ? '저장 중…' : '저장'}
      </button>
    </div>
  )
}

function F({ label, v, onChange }: { label: string; v: string | null; onChange: (v: string) => void }) {
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
