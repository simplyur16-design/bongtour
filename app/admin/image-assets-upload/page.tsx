'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import ImageAssetEditDrawer, { type ImageAssetApiRow } from './ImageAssetEditDrawer'
import {
  ADMIN_MANUAL_PRIMARY_HERO_UPLOAD_OPTIONS,
  mapAdminManualImageSourcePresetToImageAssetUpload,
  type AdminManualPrimaryHeroUploadPreset,
} from '@/lib/admin-manual-primary-hero-upload'

const ENTITY_TYPES = ['product', 'city', 'country', 'study', 'bus', 'page'] as const
const SERVICE_TYPES = ['overseas', 'domestic', 'study', 'bus', 'support'] as const
const IMAGE_ROLES = ['hero', 'thumb', 'gallery', 'og'] as const

function detectIstockFromFilename(name: string | null | undefined): boolean {
  const base = String(name ?? '').replace(/^.*[/\\]/, '').trim().toLowerCase()
  return base.startsWith('istock-')
}

function sourceBadgeClass(sourceType: string): string {
  if (sourceType === 'istock') return 'bg-slate-200 text-slate-900'
  if (sourceType === 'gemini_manual') return 'bg-violet-100 text-violet-900'
  if (sourceType === 'gemini_auto') return 'bg-indigo-100 text-indigo-900'
  if (sourceType === 'pexels') return 'bg-sky-100 text-sky-900'
  if (sourceType === 'photo_owned') return 'bg-emerald-100 text-emerald-900'
  return 'bg-gray-100 text-gray-800'
}

function sourceTypeBadgeLabelKo(sourceType: string): string {
  switch (sourceType) {
    case 'istock':
      return 'iStock'
    case 'gemini_manual':
      return 'Gemini 수동'
    case 'gemini_auto':
      return 'Gemini 자동'
    case 'pexels':
      return 'Pexels'
    case 'photo_owned':
      return '직접 보유'
    default:
      return sourceType
  }
}

function formatUploadedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR')
  } catch {
    return iso
  }
}

type UploadResult = {
  ok: boolean
  asset?: ImageAssetApiRow
  error?: string
  message?: string
}

function ImageAssetsUploadPageInner() {
  const searchParams = useSearchParams() ?? new URLSearchParams()
  const productContextId = (searchParams.get('productId') ?? '').trim()

  const [productTitle, setProductTitle] = useState<string | null>(null)
  const [productLoadErr, setProductLoadErr] = useState<string | null>(null)

  const [entityType, setEntityType] = useState<string>('product')
  const [entityId, setEntityId] = useState('')
  const [entityNameKr, setEntityNameKr] = useState('')
  const [entityNameEn, setEntityNameEn] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [serviceType, setServiceType] = useState<string>('overseas')
  const [groupKey, setGroupKey] = useState('')
  const [imageRole, setImageRole] = useState<string>('gallery')
  const [isPrimary, setIsPrimary] = useState(false)
  const [manualPreset, setManualPreset] = useState<AdminManualPrimaryHeroUploadPreset>('photo_owned')
  const [manualOtherNote, setManualOtherNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [last, setLast] = useState<UploadResult | null>(null)
  const [recent, setRecent] = useState<ImageAssetApiRow[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerRow, setDrawerRow] = useState<ImageAssetApiRow | null>(null)

  const fileName = file?.name ?? ''
  const forcedIstock = detectIstockFromFilename(fileName)
  const effectivePreset: AdminManualPrimaryHeroUploadPreset = forcedIstock ? 'istock' : manualPreset

  const loadRecent = useCallback(async () => {
    const res = await fetch('/api/admin/image-assets/recent?take=40')
    const data = await res.json()
    if (data.ok && Array.isArray(data.items)) setRecent(data.items as ImageAssetApiRow[])
  }, [])

  useEffect(() => {
    void loadRecent()
  }, [loadRecent])

  useEffect(() => {
    if (!productContextId) {
      setProductTitle(null)
      setProductLoadErr(null)
      return
    }
    let off = false
    void fetch(`/api/admin/products/${encodeURIComponent(productContextId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { title?: string }) => {
        if (!off) {
          setProductTitle(typeof d.title === 'string' ? d.title : null)
          setProductLoadErr(null)
        }
      })
      .catch(() => {
        if (!off) {
          setProductTitle(null)
          setProductLoadErr('상품 정보를 불러오지 못했습니다.')
        }
      })
    return () => {
      off = true
    }
  }, [productContextId])

  const appendSourceFields = (fd: FormData) => {
    const mapped = mapAdminManualImageSourcePresetToImageAssetUpload(effectivePreset, manualOtherNote)
    fd.set('source_type', mapped.sourceType)
    if (mapped.sourceNote) fd.set('source_note', mapped.sourceNote)
  }

  const onSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productContextId) return
    if (!file) {
      setLast({ ok: false, error: '파일을 선택하세요.' })
      return
    }
    setUploading(true)
    setLast(null)
    try {
      const fd = new FormData()
      fd.set('product_context_id', productContextId)
      fd.set('file', file)
      fd.set('is_primary', isPrimary ? 'true' : 'false')
      fd.set('image_role', 'gallery')
      fd.set('sort_order', '0')
      appendSourceFields(fd)
      const res = await fetch('/api/admin/image-assets/upload', { method: 'POST', body: fd })
      const data = (await res.json()) as UploadResult
      setLast(data)
      if (data.ok) void loadRecent()
    } catch (err) {
      setLast({ ok: false, error: err instanceof Error ? err.message : '요청 실패' })
    } finally {
      setUploading(false)
    }
  }

  const onSubmitGeneral = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setLast({ ok: false, error: '파일을 선택하세요.' })
      return
    }
    if (!entityId.trim() || !entityNameKr.trim()) {
      setLast({ ok: false, error: 'entity_id와 entity_name_kr은 필수입니다.' })
      return
    }
    setUploading(true)
    setLast(null)
    try {
      const fd = new FormData()
      fd.set('entity_type', entityType)
      fd.set('entity_id', entityId.trim())
      fd.set('entity_name_kr', entityNameKr.trim())
      if (entityNameEn.trim()) fd.set('entity_name_en', entityNameEn.trim())
      if (supplierName.trim()) fd.set('supplier_name', supplierName.trim())
      fd.set('service_type', serviceType)
      if (groupKey.trim()) fd.set('group_key', groupKey.trim())
      fd.set('image_role', imageRole)
      fd.set('is_primary', isPrimary ? 'true' : 'false')
      fd.set('sort_order', '0')
      appendSourceFields(fd)
      fd.set('file', file)
      const res = await fetch('/api/admin/image-assets/upload', { method: 'POST', body: fd })
      const data = (await res.json()) as UploadResult
      setLast(data)
      if (data.ok) void loadRecent()
    } catch (err) {
      setLast({ ok: false, error: err instanceof Error ? err.message : '요청 실패' })
    } finally {
      setUploading(false)
    }
  }

  function openEdit(r: ImageAssetApiRow) {
    setDrawerRow(r)
    setDrawerOpen(true)
  }

  function onDrawerSaved(asset: ImageAssetApiRow) {
    setRecent((prev) => prev.map((r) => (r.id === asset.id ? asset : r)))
    void loadRecent()
  }

  const sourceFieldsBlock = (
    <>
      <label className="block text-sm">
        <span className="font-medium text-bt-title">이미지 출처</span>
        <select
          className="mt-1 w-full max-w-md rounded border border-bt-border px-2 py-2"
          value={effectivePreset}
          disabled={uploading || forcedIstock}
          onChange={(e) => setManualPreset(e.target.value as AdminManualPrimaryHeroUploadPreset)}
        >
          {ADMIN_MANUAL_PRIMARY_HERO_UPLOAD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {forcedIstock ? (
          <p className="mt-1 text-[11px] font-medium text-amber-800">파일명이 iStock- 으로 시작해 출처가 iStock으로 고정됩니다.</p>
        ) : null}
      </label>
      {effectivePreset === 'other' ? (
        <label className="block text-sm">
          <span className="font-medium text-bt-title">기타 출처 설명</span>
          <input
            className="mt-1 w-full max-w-md rounded border border-bt-border px-2 py-2"
            value={manualOtherNote}
            disabled={uploading}
            onChange={(e) => setManualOtherNote(e.target.value)}
            placeholder="짧게 입력 (내부 메모로 저장)"
          />
        </label>
      ) : null}
    </>
  )

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold text-bt-title">이미지 업로드</h1>
        <p className="mt-1 text-sm text-bt-muted">
          상품 작업: <strong className="text-bt-body">파일 + 출처</strong>만 선택합니다. 파일명·alt·경로·SEO 제목은 서버에서 상품 문맥으로 생성합니다.
        </p>
      </div>

      {productContextId ? (
        <form onSubmit={onSubmitProduct} className="space-y-4 rounded-xl border border-bt-border bg-white p-4 shadow-sm">
          <div className="rounded-lg border border-bt-border-soft bg-bt-surface-soft px-3 py-2 text-sm">
            <p className="font-medium text-bt-title">상품에 이미지 추가</p>
            {productLoadErr ? (
              <p className="mt-1 text-bt-warning">{productLoadErr}</p>
            ) : (
              <p className="mt-1 text-bt-muted">
                상품 ID: <code className="text-xs">{productContextId}</code>
                {productTitle ? (
                  <>
                    {' · '}
                    <span className="text-bt-body">{productTitle}</span>
                  </>
                ) : (
                  ' · …'
                )}
              </p>
            )}
            <p className="mt-2 text-xs text-bt-meta">
              entity·공급사·service_type·SEO 제목은 서버에서 이 상품 기준으로 채웁니다. 역할은 기본 <code>gallery</code>입니다.
            </p>
            <Link href="/admin/image-assets-upload" className="mt-2 inline-block text-xs font-medium text-bt-link underline">
              상품 없이 범용 등록으로 전환
            </Link>
          </div>
          {sourceFieldsBlock}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPrimary} disabled={uploading} onChange={(e) => setIsPrimary(e.target.checked)} />
            이 상품의 대표 이미지로 설정 (기존 대표 해제)
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-bt-title">파일</span>
            <input
              type="file"
              accept="image/*"
              className="mt-1 w-full text-sm"
              disabled={uploading}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="submit"
            disabled={uploading || Boolean(productLoadErr)}
            className="rounded-lg bg-bt-brand-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {uploading ? '업로드 중…' : '상품에 업로드'}
          </button>
        </form>
      ) : (
        <details className="rounded-xl border border-bt-border bg-white p-4 shadow-sm open:shadow-md">
          <summary className="cursor-pointer text-sm font-semibold text-bt-title">범용 자산 등록 (도시·국가·스터디 등)</summary>
          <form onSubmit={onSubmitGeneral} className="mt-4 space-y-4">
            <p className="text-xs text-bt-muted">
              상품이 아닌 엔티티는 아래 식별자를 직접 입력합니다. 출처는 위와 동일한 목록을 사용합니다.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-bt-muted">entity_type</span>
                <select
                  className="mt-1 w-full rounded border border-bt-border px-2 py-2"
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                >
                  {ENTITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-bt-muted">entity_id</span>
                <input
                  className="mt-1 w-full rounded border border-bt-border px-2 py-2"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  required
                  placeholder="cuid..."
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-bt-muted">entity_name_kr</span>
                <input
                  className="mt-1 w-full rounded border border-bt-border px-2 py-2"
                  value={entityNameKr}
                  onChange={(e) => setEntityNameKr(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-bt-muted">entity_name_en (선택)</span>
                <input
                  className="mt-1 w-full rounded border border-bt-border px-2 py-2"
                  value={entityNameEn}
                  onChange={(e) => setEntityNameEn(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-bt-muted">supplier_name (선택)</span>
                <input
                  className="mt-1 w-full rounded border border-bt-border px-2 py-2"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-bt-muted">service_type</span>
                <select
                  className="mt-1 w-full rounded border border-bt-border px-2 py-2"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                >
                  {SERVICE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-bt-muted">group_key (선택)</span>
                <input
                  className="mt-1 w-full rounded border border-bt-border px-2 py-2"
                  value={groupKey}
                  onChange={(e) => setGroupKey(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-bt-muted">image_role</span>
                <select
                  className="mt-1 w-full rounded border border-bt-border px-2 py-2"
                  value={imageRole}
                  onChange={(e) => setImageRole(e.target.value)}
                >
                  {IMAGE_ROLES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
                대표 이미지
              </label>
              <div className="space-y-3 sm:col-span-2">{sourceFieldsBlock}</div>
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium text-bt-title">파일</span>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 w-full text-sm"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={uploading}
              className="rounded-lg bg-bt-brand-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {uploading ? '업로드 중…' : '업로드'}
            </button>
          </form>
        </details>
      )}

      {last && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            last.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
          }`}
        >
          {last.ok && last.asset ? (
            <div className="space-y-2">
              <p className="font-medium text-emerald-900">업로드 성공</p>
              <p className="text-xs text-emerald-950">
                <a href={last.asset.publicUrl} className="font-medium text-blue-700 underline" target="_blank" rel="noreferrer">
                  미리보기
                </a>
                <span className="text-bt-muted"> · </span>
                <span className="font-mono text-[11px]">{last.asset.fileName}</span>
              </p>
            </div>
          ) : (
            <p className="text-red-800">{last.message ?? last.error}</p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-bt-border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-bt-title">최근 업로드</h2>
        <ul className="mt-3 max-h-[min(70vh,32rem)] space-y-4 overflow-y-auto overscroll-contain pr-1 text-xs [-webkit-overflow-scrolling:touch]">
          {recent.map((r) => (
            <li key={r.id} className="flex gap-3 border-b border-bt-border pb-4">
              <div className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.publicUrl} alt="" className="h-16 w-16 rounded border border-slate-200 object-cover" loading="lazy" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{r.entityNameKr}</div>
                <div className="mt-0.5 text-[11px] text-bt-muted">
                  {r.entityType} · {r.imageRole}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${sourceBadgeClass(r.sourceType)}`}>
                    {sourceTypeBadgeLabelKo(r.sourceType)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="rounded border border-slate-400 bg-white px-2 py-1 text-[11px] font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    수정
                  </button>
                  <a href={r.publicUrl} target="_blank" rel="noreferrer" className="text-[11px] text-blue-700 underline">
                    원본 열기
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <ImageAssetEditDrawer
        open={drawerOpen}
        row={drawerRow}
        onClose={() => {
          setDrawerOpen(false)
          setDrawerRow(null)
        }}
        onSaved={onDrawerSaved}
      />
    </div>
  )
}

export default function ImageAssetsUploadPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl p-6 text-sm text-bt-muted">로딩 중…</div>}>
      <ImageAssetsUploadPageInner />
    </Suspense>
  )
}
