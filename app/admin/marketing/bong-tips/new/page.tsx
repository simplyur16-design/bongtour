'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { TIP_KIND_OPTIONS } from '../../tip-kind-options'

const STATUS_OPTIONS = ['draft', 'approved', 'published'] as const

export default function AdminBongTipNewPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    body: '',
    tipKind: '' as string,
    country: '',
    city: '',
    countryKey: '',
    cityKey: '',
    status: 'draft' as (typeof STATUS_OPTIONS)[number],
  })

  const submit = async () => {
    if (!form.title.trim()) {
      setError('제목을 입력하세요.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/marketing/bong-tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          body: form.body || undefined,
          tipKind: form.tipKind || undefined,
          country: form.country || undefined,
          city: form.city || undefined,
          countryKey: form.countryKey || undefined,
          cityKey: form.cityKey || undefined,
          status: form.status,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      router.push(`/admin/marketing/bong-tips/${data.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/marketing/bong-tips" className="text-sm text-bt-brand-blue hover:underline">
        ← 목록
      </Link>
      <h1 className="text-xl font-semibold text-bt-title">새 봉 팁</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-3 rounded-lg border border-bt-border-strong bg-white p-4 sm:grid-cols-2">
        <label className="block text-xs text-bt-body/80 sm:col-span-2">
          제목 *
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs text-bt-body/80 sm:col-span-2">
          팁 종류
          <select
            value={form.tipKind}
            onChange={(e) => setForm((f) => ({ ...f, tipKind: e.target.value }))}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">선택</option>
            {TIP_KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <L label="국가" v={form.country} onChange={(v) => setForm((f) => ({ ...f, country: v }))} />
        <L label="도시" v={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
        <L label="countryKey" v={form.countryKey} onChange={(v) => setForm((f) => ({ ...f, countryKey: v }))} />
        <L label="cityKey" v={form.cityKey} onChange={(v) => setForm((f) => ({ ...f, cityKey: v }))} />
      </div>
      <label className="block text-xs text-bt-body/80">
        본문
        <textarea
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          rows={8}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="text-sm">
        상태{' '}
        <select
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as (typeof STATUS_OPTIONS)[number] }))}
          className="rounded border border-gray-300 px-2 py-1"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="rounded-lg bg-bt-brand-blue px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        <Link href="/admin/marketing/bong-tips" className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
          취소
        </Link>
      </div>
    </div>
  )
}

function L({ label, v, onChange }: { label: string; v: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs text-bt-body/80">
      {label}
      <input
        value={v}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
      />
    </label>
  )
}
