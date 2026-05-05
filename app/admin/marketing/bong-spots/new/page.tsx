'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const STATUS_OPTIONS = ['draft', 'approved', 'published'] as const

export default function AdminBongSpotNewPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    slug: '',
    summary: '',
    body: '',
    country: '',
    city: '',
    countryKey: '',
    cityKey: '',
    heroImageUrl: '',
    status: 'draft' as (typeof STATUS_OPTIONS)[number],
  })

  const submit = async () => {
    if (!form.title.trim()) {
      setError('제목을 입력하세요.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/admin/marketing/bong-spots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          slug: form.slug.trim() || undefined,
          summary: form.summary || undefined,
          body: form.body || undefined,
          country: form.country || undefined,
          city: form.city || undefined,
          countryKey: form.countryKey || undefined,
          cityKey: form.cityKey || undefined,
          heroImageUrl: form.heroImageUrl || undefined,
          status: form.status,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      router.push(`/admin/marketing/bong-spots/${data.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/marketing/bong-spots" className="text-sm text-bt-brand-blue hover:underline">
          ← 목록
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-bt-title">새 봉 스팟</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="space-y-3 rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-bt-title">위치</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="국가 (표시)" value={form.country} onChange={(v) => setForm((f) => ({ ...f, country: v }))} />
          <Field label="도시 (표시)" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
          <Field label="countryKey" value={form.countryKey} onChange={(v) => setForm((f) => ({ ...f, countryKey: v }))} />
          <Field label="cityKey" value={form.cityKey} onChange={(v) => setForm((f) => ({ ...f, cityKey: v }))} />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-bt-title">식별</h2>
        <Field label="제목 *" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} />
        <Field label="slug (선택, 유니크)" value={form.slug} onChange={(v) => setForm((f) => ({ ...f, slug: v }))} />
      </section>

      <section className="space-y-3 rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-bt-title">콘텐츠</h2>
        <label className="block text-xs text-bt-body/80">
          요약
          <textarea
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            rows={2}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs text-bt-body/80">
          본문
          <textarea
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={8}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm font-mono"
          />
        </label>
      </section>

      <section className="space-y-3 rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-bt-title">이미지</h2>
        <Field
          label="heroImageUrl (공개 URL)"
          value={form.heroImageUrl}
          onChange={(v) => setForm((f) => ({ ...f, heroImageUrl: v }))}
        />
        <p className="text-xs text-bt-body/60">
          Ncloud 등 업로드 후 공개 URL을 붙여넣거나,{' '}
          <Link href="/admin/image-assets-upload" className="text-bt-brand-blue hover:underline">
            이미지 업로드
          </Link>{' '}
          에서 경로를 확인하세요.
        </p>
      </section>

      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-bt-border-strong bg-white p-4 shadow-sm">
        <label className="text-sm text-bt-body">
          상태{' '}
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as (typeof STATUS_OPTIONS)[number] }))}
            className="ml-2 rounded border border-gray-300 px-2 py-1"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="rounded-lg bg-bt-brand-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        <Link href="/admin/marketing/bong-spots" className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
          취소
        </Link>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block text-xs text-bt-body/80">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
      />
    </label>
  )
}
