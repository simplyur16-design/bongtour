'use client'

import { useCallback, useEffect, useState } from 'react'
import ImageAssetEditDrawer, { type ImageAssetApiRow } from './ImageAssetEditDrawer'

const ENTITY_TYPES = ['product', 'city', 'country', 'study', 'bus', 'page'] as const
const SERVICE_TYPES = ['overseas', 'domestic', 'study', 'bus', 'support'] as const
const IMAGE_ROLES = ['hero', 'thumb', 'gallery', 'og'] as const
const MANUAL_SOURCE_TYPES = ['gemini_manual', 'photo_owned', 'istock'] as const
type ManualSourceType = (typeof MANUAL_SOURCE_TYPES)[number]

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

/** 내부 관리용 배지 라벨 (SEO alt에 넣지 않음) */
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

export default function ImageAssetsUploadPage() {
  const [entityType, setEntityType] = useState<string>('product')
  const [entityId, setEntityId] = useState('')
  const [entityNameKr, setEntityNameKr] = useState('')
  const [entityNameEn, setEntityNameEn] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [serviceType, setServiceType] = useState<string>('overseas')
  const [groupKey, setGroupKey] = useState('')
  const [imageRole, setImageRole] = useState<string>('hero')
  const [isPrimary, setIsPrimary] = useState(false)
  const [sortOrder, setSortOrder] = useState(0)
  const [sourceType, setSourceType] = useState<ManualSourceType>('photo_owned')
  const [seoTitleKr, setSeoTitleKr] = useState('')
  const [seoTitleEn, setSeoTitleEn] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [last, setLast] = useState<UploadResult | null>(null)
  const [recent, setRecent] = useState<ImageAssetApiRow[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerRow, setDrawerRow] = useState<ImageAssetApiRow | null>(null)

  const fileName = file?.name ?? ''
  const forcedIstock = detectIstockFromFilename(fileName)
  const effectiveSourceType: ManualSourceType = forcedIstock ? 'istock' : sourceType

  const loadRecent = useCallback(async () => {
    const res = await fetch('/api/admin/image-assets/recent?take=40')
    const data = await res.json()
    if (data.ok && Array.isArray(data.items)) setRecent(data.items as ImageAssetApiRow[])
  }, [])

  useEffect(() => {
    void loadRecent()
  }, [loadRecent])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setLast({ ok: false, error: '파일을 선택하세요.' })
      return
    }
    setUploading(true)
    setLast(null)
    try {
      const fd = new FormData()
      fd.set('entity_type', entityType)
      fd.set('entity_id', entityId)
      fd.set('entity_name_kr', entityNameKr)
      if (entityNameEn.trim()) fd.set('entity_name_en', entityNameEn)
      if (supplierName.trim()) fd.set('supplier_name', supplierName)
      fd.set('service_type', serviceType)
      if (groupKey.trim()) fd.set('group_key', groupKey)
      fd.set('image_role', imageRole)
      fd.set('is_primary', isPrimary ? 'true' : 'false')
      fd.set('sort_order', String(sortOrder))
      fd.set('source_type', effectiveSourceType)
      if (seoTitleKr.trim()) fd.set('seo_title_kr', seoTitleKr.trim())
      if (seoTitleEn.trim()) fd.set('seo_title_en', seoTitleEn.trim())
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

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold text-bt-title">이미지 업로드 (SSOT)</h1>
        <p className="mt-1 text-sm text-bt-muted">
          Storage 객체 경로·<code>file_name</code>·<code>public_url</code>·alt는 서버 SSOT로 생성됩니다(엔티티·역할·순번 기반 슬러그 규칙).
          아래 <code>seo_title_kr</code>/<code>seo_title_en</code>은 표시·메타·일정 연동용이며 파일명을 바꾸지 않습니다. Ncloud Object Storage(
          버킷 <code>bongtour</code> 등) + Prisma <code>image_assets</code>. <code>source_type</code>은 내부 원천 구분용입니다.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-bt-border bg-white p-4 shadow-sm">
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
            <span className="text-bt-muted">entity_id (상품 id 등)</span>
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
            <span className="text-bt-muted">entity_name_en (선택, slug·alt_en 보조)</span>
            <input
              className="mt-1 w-full rounded border border-bt-border px-2 py-2"
              value={entityNameEn}
              onChange={(e) => setEntityNameEn(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-bt-muted">supplier_name (product 권장)</span>
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
            <span className="text-bt-muted">group_key (city/country/study 등 region slug — 선택)</span>
            <input
              className="mt-1 w-full rounded border border-bt-border px-2 py-2"
              value={groupKey}
              onChange={(e) => setGroupKey(e.target.value)}
              placeholder="예: japan (미입력 시 서버 추론)"
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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
            대표 이미지 (동일 entity_id 기존 대표 해제)
          </label>
          <label className="block text-sm">
            <span className="text-bt-muted">sort_order</span>
            <input
              type="number"
              className="mt-1 w-full rounded border border-bt-border px-2 py-2"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-bt-muted">source_type (수동 업로드)</span>
            <select
              className="mt-1 w-full rounded border border-bt-border px-2 py-2"
              value={forcedIstock ? 'istock' : sourceType}
              onChange={(e) => setSourceType(e.target.value as ManualSourceType)}
              disabled={forcedIstock}
            >
              <option value="gemini_manual">gemini_manual</option>
              <option value="photo_owned">photo_owned</option>
              <option value="istock">istock</option>
            </select>
            <p className="mt-1 text-[11px] text-bt-muted">
              기본값 <code>photo_owned</code>. <code>pexels</code>, <code>gemini_auto</code>는 자동 파이프라인 전용입니다.
            </p>
            {forcedIstock ? (
              <p className="mt-1 text-[11px] font-medium text-amber-800">
                파일명이 iStock-으로 시작하여 원천이 iStock으로 자동 고정되었습니다.
              </p>
            ) : null}
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-bt-muted">seo_title_kr (내부 SEO 메타)</span>
            <input
              className="mt-1 w-full rounded border border-bt-border px-2 py-2"
              value={seoTitleKr}
              onChange={(e) => setSeoTitleKr(e.target.value)}
              placeholder="예: 모두투어 오사카 교토 3박4일 패키지"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-bt-muted">seo_title_en (내부 SEO 메타)</span>
            <input
              className="mt-1 w-full rounded border border-bt-border px-2 py-2"
              value={seoTitleEn}
              onChange={(e) => setSeoTitleEn(e.target.value)}
              placeholder="Ex: Modetour Osaka Kyoto 3N4D Package"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-bt-muted">파일 (서버에서 WebP 표준화)</span>
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

      {last && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            last.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
          }`}
        >
          {last.ok && last.asset ? (
            <div className="space-y-2">
              <p className="font-medium text-emerald-900">업로드 성공</p>
              <dl className="grid gap-1 font-mono text-xs text-emerald-950">
                <div>
                  <dt className="inline text-bt-muted">sourceType: </dt>
                  <dd className="inline">{last.asset.sourceType}</dd>
                </div>
                <div>
                  <dt className="inline text-bt-muted">sourceName: </dt>
                  <dd className="inline">{last.asset.sourceName ?? '-'}</dd>
                </div>
                <div>
                  <dt className="inline text-bt-muted">isGenerated: </dt>
                  <dd className="inline">{last.asset.isGenerated == null ? '-' : String(last.asset.isGenerated)}</dd>
                </div>
                <div>
                  <dt className="inline text-bt-muted">fileName: </dt>
                  <dd className="inline">{last.asset.fileName}</dd>
                </div>
                <div>
                  <dt className="inline text-bt-muted">storagePath: </dt>
                  <dd className="inline break-all">{last.asset.storagePath}</dd>
                </div>
                <div>
                  <dt className="inline text-bt-muted">publicUrl: </dt>
                  <dd className="inline break-all">
                    <a href={last.asset.publicUrl} className="text-blue-700 underline" target="_blank" rel="noreferrer">
                      {last.asset.publicUrl}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="inline text-bt-muted">alt_kr: </dt>
                  <dd className="inline">{last.asset.altKr}</dd>
                </div>
                <div>
                  <dt className="inline text-bt-muted">alt_en: </dt>
                  <dd className="inline">{last.asset.altEn}</dd>
                </div>
                <div>
                  <dt className="inline text-bt-muted">seo_title_kr: </dt>
                  <dd className="inline">{last.asset.seoTitleKr ?? '-'}</dd>
                </div>
                <div>
                  <dt className="inline text-bt-muted">seo_title_en: </dt>
                  <dd className="inline">{last.asset.seoTitleEn ?? '-'}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="text-red-800">{last.message ?? last.error}</p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-bt-border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-bt-title">최근 업로드</h2>
        <ul className="mt-3 max-h-[min(70vh,32rem)] space-y-4 overflow-y-auto overscroll-contain pr-1 text-xs [-webkit-overflow-scrolling:touch]">
          {recent.map((r) => {
            const seoKr = r.seoTitleKr?.trim() ?? ''
            const seoEn = r.seoTitleEn?.trim() ?? ''
            const primarySeo = seoKr || seoEn
            const secondarySeo = seoKr && seoEn ? (seoKr === primarySeo ? seoEn : seoKr) : ''
            return (
            <li key={r.id} className="flex gap-3 border-b border-bt-border pb-4">
              <div className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.publicUrl}
                  alt=""
                  className="h-16 w-16 rounded border border-slate-200 object-cover"
                  loading="lazy"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px] text-bt-muted">{r.id}</div>
                {primarySeo ? (
                  <div className="mt-0.5 text-sm font-semibold text-slate-900" title="seo_title_kr/en 표시 우선 (file_name 아님)">
                    {primarySeo}
                  </div>
                ) : null}
                {secondarySeo ? (
                  <div className="mt-0.5 text-xs text-slate-600">{secondarySeo}</div>
                ) : null}
                <div className={`text-sm text-slate-900 ${primarySeo ? 'mt-0.5 text-xs text-slate-600' : 'mt-0.5'}`}>
                  {r.entityType} · {r.entityNameKr} · {r.imageRole}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${sourceBadgeClass(r.sourceType)}`}>
                    {sourceTypeBadgeLabelKo(r.sourceType)}
                  </span>
                  <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                    {r.sourceName ?? '-'}
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-800">
                    {r.isGenerated === true ? '생성형' : '비생성형'}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-700">
                  <div>
                    file_name: <span className="font-mono">{r.fileName}</span>
                  </div>
                  <div>alt_kr: {r.altKr || '—'}</div>
                  <div>alt_en: {r.altEn || '—'}</div>
                  <div>seo_title_kr: {r.seoTitleKr || '—'}</div>
                  <div>seo_title_en: {r.seoTitleEn || '—'}</div>
                  <div className="text-bt-muted">업로드: {formatUploadedAt(r.uploadedAt)}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="rounded border border-slate-400 bg-white px-2 py-1 text-[11px] font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    수정
                  </button>
                  <a
                    href={r.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-700 underline"
                  >
                    원본 열기
                  </a>
                </div>
              </div>
            </li>
            )
          })}
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
