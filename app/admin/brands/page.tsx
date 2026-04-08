'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Brand = {
  id: string
  brandKey: string
  displayName: string
  logoPath: string | null
  primaryColor: string | null
  disclaimerText: string | null
  officialUrl: string | null
  productUrlTemplate: string | null
  defaultTerms: string | null
  cancelFeeTerms: string | null
  sortOrder: number
}

function AddBrandForm({ onAdded }: { onAdded: (b: Brand) => void }) {
  const [brandKey, setBrandKey] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!brandKey.trim() || !displayName.trim()) return
    setErr('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandKey: brandKey.trim(), displayName: displayName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '추가 실패')
      onAdded(data)
      setBrandKey('')
      setDisplayName('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : '추가 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <input
        value={brandKey}
        onChange={(e) => setBrandKey(e.target.value)}
        placeholder="브랜드 키 (영문, 예: hanatour)"
        className="rounded border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="표시명 (예: 하나투어)"
        className="rounded border border-gray-300 px-3 py-2 text-sm"
      />
      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {loading ? '추가 중…' : '추가'}
      </button>
      {err && <span className="text-sm text-red-600">{err}</span>}
    </div>
  )
}

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/brands')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setBrands(data)
        else setError(data?.error ?? '목록 조회 실패')
      })
      .catch(() => setError('목록 조회 실패'))
      .finally(() => setLoading(false))
  }, [])

  const updateLocal = (brandKey: string, field: keyof Brand, value: string | number | null) => {
    setBrands((prev) =>
      prev.map((b) =>
        b.brandKey === brandKey ? { ...b, [field]: value } : b
      )
    )
  }

  const save = async (b: Brand) => {
    setSaving(b.brandKey)
    setError('')
    try {
      const res = await fetch(`/api/admin/brands/${encodeURIComponent(b.brandKey)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: b.displayName,
          logoPath: b.logoPath || null,
          primaryColor: b.primaryColor || null,
          disclaimerText: b.disclaimerText || null,
          officialUrl: b.officialUrl || null,
          productUrlTemplate: b.productUrlTemplate || null,
          defaultTerms: b.defaultTerms || null,
          cancelFeeTerms: b.cancelFeeTerms || null,
          sortOrder: b.sortOrder,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm font-medium text-gray-500">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/register"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            ← 상품 등록
          </Link>
          <h1 className="text-lg font-bold text-gray-900">업체 브랜드 관리 (30개+ 확장)</h1>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        <p className="mb-4 text-sm text-gray-600">
          로고·고유 색상·면피 문구·공식 사이트 URL·상품 링크 템플릿·기본 약관·취소 수수료 규정을 설정하면 모든 상품 페이지에 브랜드 인장으로 반영됩니다. 빈 항목은 기본값/자동 문구가 사용됩니다.
        </p>

        {brands.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
            등록된 브랜드가 없습니다. 터미널에서 <code className="rounded bg-gray-100 px-1">npm run db:seed</code> 실행 후 새로고침하세요.
          </div>
        ) : null}
        {brands.length > 0 && (
          <div className="space-y-6">
            {brands.map((b) => (
              <section
                key={b.brandKey}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
                  <h2 className="font-bold text-gray-900">
                    {b.displayName} <span className="text-sm font-normal text-gray-500">({b.brandKey})</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => save(b)}
                    disabled={saving === b.brandKey}
                    className="flex items-center gap-1.5 rounded-lg bg-bong-orange px-3 py-1.5 text-sm font-medium text-white hover:bg-bong-orange/90 disabled:opacity-50"
                  >
                    {saving === b.brandKey ? '저장 중…' : '저장'}
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500">표시명</label>
                    <input
                      value={b.displayName}
                      onChange={(e) => updateLocal(b.brandKey, 'displayName', e.target.value)}
                      className="mt-0.5 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">로고 경로 (예: /logos/hanatour.png)</label>
                    <input
                      value={b.logoPath ?? ''}
                      onChange={(e) => updateLocal(b.brandKey, 'logoPath', e.target.value || null)}
                      className="mt-0.5 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">고유 색상 (#hex)</label>
                    <div className="mt-0.5 flex gap-2">
                      <input
                        type="color"
                        value={b.primaryColor ?? '#f97316'}
                        onChange={(e) => updateLocal(b.brandKey, 'primaryColor', e.target.value)}
                        className="h-10 w-14 cursor-pointer rounded border border-gray-300"
                      />
                      <input
                        value={b.primaryColor ?? ''}
                        onChange={(e) => updateLocal(b.brandKey, 'primaryColor', e.target.value || null)}
                        placeholder="#f97316"
                        className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">공식 사이트 URL</label>
                    <input
                      value={b.officialUrl ?? ''}
                      onChange={(e) => updateLocal(b.brandKey, 'officialUrl', e.target.value || null)}
                      placeholder="https://..."
                      className="mt-0.5 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500">상품 URL 템플릿 (카톡 전달용) — &#123;code&#125;, &#123;group&#125; 치환</label>
                    <input
                      value={b.productUrlTemplate ?? ''}
                      onChange={(e) => updateLocal(b.brandKey, 'productUrlTemplate', e.target.value || null)}
                      placeholder="https://hanatour.com/product?code={code}&group={group}"
                      className="mt-0.5 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500">면피 문구 (비우면 기본 문구 사용)</label>
                    <textarea
                      value={b.disclaimerText ?? ''}
                      onChange={(e) => updateLocal(b.brandKey, 'disclaimerText', e.target.value || null)}
                      rows={2}
                      className="mt-0.5 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500">기본 약관</label>
                    <textarea
                      value={b.defaultTerms ?? ''}
                      onChange={(e) => updateLocal(b.brandKey, 'defaultTerms', e.target.value || null)}
                      rows={4}
                      className="mt-0.5 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500">취소·환불 수수료 규정</label>
                    <textarea
                      value={b.cancelFeeTerms ?? ''}
                      onChange={(e) => updateLocal(b.brandKey, 'cancelFeeTerms', e.target.value || null)}
                      rows={4}
                      className="mt-0.5 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

        <section className="mt-8 rounded-xl border border-dashed border-gray-300 bg-white p-5">
          <h2 className="mb-3 font-bold text-gray-800">브랜드 추가 (30개+ 확장)</h2>
          <AddBrandForm
            onAdded={(newBrand) =>
              setBrands((prev) => [...prev, newBrand].sort((a, b) => a.sortOrder - b.sortOrder))
            }
          />
        </section>
      </main>
    </div>
  )
}
