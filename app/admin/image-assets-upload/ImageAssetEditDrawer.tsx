'use client'

import { useEffect, useState } from 'react'
import {
  ADMIN_MANUAL_PRIMARY_HERO_UPLOAD_OPTIONS,
  mapAdminManualImageSourcePresetToImageAssetUpload,
  type AdminManualPrimaryHeroUploadPreset,
} from '@/lib/admin-manual-primary-hero-upload'

const ALL_SOURCE_TYPES = ['pexels', 'gemini_auto', 'gemini_manual', 'photo_owned', 'istock'] as const

const SOURCE_TYPE_LABEL_KO: Record<string, string> = {
  pexels: 'Pexels',
  gemini_auto: 'Gemini 자동',
  gemini_manual: 'Gemini 수동',
  photo_owned: '직접 보유',
  istock: 'iStock',
}

export type ImageAssetApiRow = {
  id: string
  entityType: string
  entityId: string
  entityNameKr: string
  entityNameEn: string | null
  imageRole: string
  fileName: string
  storagePath: string
  publicUrl: string
  altKr: string
  altEn: string
  sourceType: string
  sourceName: string | null
  sourceNote: string | null
  isGenerated: boolean | null
  seoTitleKr: string | null
  seoTitleEn: string | null
  isPrimary: boolean
  sortOrder: number
  uploadedAt: string
}

function detectIstockFromStoredFileName(name: string): boolean {
  const base = String(name ?? '').replace(/^.*[/\\]/, '').trim().toLowerCase()
  return base.startsWith('istock-')
}

type Props = {
  open: boolean
  row: ImageAssetApiRow | null
  onClose: () => void
  onSaved: (asset: ImageAssetApiRow) => void
}

export default function ImageAssetEditDrawer({ open, row, onClose, onSaved }: Props) {
  const [sourceType, setSourceType] = useState<string>('photo_owned')
  const [sourceNote, setSourceNote] = useState('')
  const [altKr, setAltKr] = useState('')
  const [altEn, setAltEn] = useState('')
  const [isPrimary, setIsPrimary] = useState(false)
  const [sortOrder, setSortOrder] = useState(0)
  const [seoTitleKr, setSeoTitleKr] = useState('')
  const [seoTitleEn, setSeoTitleEn] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!row) return
    if (row.entityType === 'product') {
      const ok = ADMIN_MANUAL_PRIMARY_HERO_UPLOAD_OPTIONS.some((o) => o.value === row.sourceType)
      setSourceType(ok ? row.sourceType : 'photo_owned')
    } else {
      setSourceType(row.sourceType)
    }
    setSourceNote(row.sourceNote ?? '')
    setAltKr(row.altKr ?? '')
    setAltEn(row.altEn ?? '')
    setIsPrimary(row.isPrimary)
    setSortOrder(row.sortOrder)
    setSeoTitleKr(row.seoTitleKr ?? '')
    setSeoTitleEn(row.seoTitleEn ?? '')
    setError(null)
  }, [row])

  if (!open || !row) return null

  const current = row
  const lockedIstock = current.sourceType === 'istock' || detectIstockFromStoredFileName(current.fileName)
  const autoPipeline = current.sourceType === 'pexels' || current.sourceType === 'gemini_auto'
  const isProductEntity = current.entityType === 'product'

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const body = isProductEntity
        ? (() => {
            const preset = (lockedIstock ? 'istock' : sourceType) as AdminManualPrimaryHeroUploadPreset
            const mapped = mapAdminManualImageSourcePresetToImageAssetUpload(preset, sourceNote)
            return {
              sourceType: mapped.sourceType,
              sourceNote: mapped.sourceNote,
              isPrimary,
            }
          })()
        : {
            sourceType: lockedIstock ? 'istock' : sourceType,
            sourceNote: sourceNote.trim() || null,
            seoTitleKr: seoTitleKr.trim() || null,
            seoTitleEn: seoTitleEn.trim() || null,
            altKr,
            altEn,
            isPrimary,
            sortOrder,
          }
      const res = await fetch(`/api/admin/image-assets/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(typeof data.error === 'string' ? data.error : '저장 실패')
        return
      }
      onSaved(data.asset as ImageAssetApiRow)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button type="button" className="fixed inset-0 z-[60] bg-black/40" aria-label="닫기" onClick={onClose} />
      <div
        className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            {isProductEntity ? '상품 이미지 출처' : '이미지 자산 수정'}
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-sm">
          {lockedIstock ? (
            <p className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              파일명이 <code className="font-mono">iStock-</code>로 시작하여 원천은 <strong>iStock</strong>으로 고정됩니다.
            </p>
          ) : null}
          {autoPipeline ? (
            <p className="mb-3 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
              자동 수집·생성 자산입니다. 출처 변경 시 주의하세요.
            </p>
          ) : null}

          <dl className="space-y-2 text-xs text-slate-700">
            <div>
              <dt className="text-slate-500">상품·엔티티</dt>
              <dd>
                {current.entityNameKr} ({current.entityType})
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">미리보기</dt>
              <dd>
                <a href={current.publicUrl} className="text-blue-700 underline" target="_blank" rel="noreferrer">
                  열기
                </a>
              </dd>
            </div>
          </dl>

          {isProductEntity ? (
            <>
              <label className="mt-4 block">
                <span className="text-xs font-medium text-slate-700">출처</span>
                <select
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm disabled:bg-slate-100"
                  value={lockedIstock ? 'istock' : sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  disabled={lockedIstock || autoPipeline}
                >
                  {ADMIN_MANUAL_PRIMARY_HERO_UPLOAD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              {!lockedIstock && !autoPipeline && sourceType === 'other' ? (
                <label className="mt-3 block">
                  <span className="text-xs font-medium text-slate-700">기타 출처 설명</span>
                  <textarea
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-xs"
                    rows={2}
                    value={sourceNote}
                    onChange={(e) => setSourceNote(e.target.value)}
                    placeholder="필수: 짧게 입력"
                  />
                </label>
              ) : null}
              <label className="mt-4 flex items-center gap-2">
                <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
                <span className="text-sm">이 상품의 대표 이미지</span>
              </label>
            </>
          ) : (
            <>
              <dl className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-700">
                <div>
                  <dt className="text-slate-500">file_name</dt>
                  <dd className="font-mono break-all">{current.fileName}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">source_name</dt>
                  <dd>{current.sourceName ?? '-'}</dd>
                </div>
              </dl>
              <label className="mt-4 block">
                <span className="text-xs font-medium text-slate-700">출처 유형</span>
                <select
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm disabled:bg-slate-100"
                  value={lockedIstock ? 'istock' : sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  disabled={lockedIstock}
                >
                  {ALL_SOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {SOURCE_TYPE_LABEL_KO[t] ?? t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block">
                <span className="text-xs font-medium text-slate-700">source_note</span>
                <textarea
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-xs"
                  rows={3}
                  value={sourceNote}
                  onChange={(e) => setSourceNote(e.target.value)}
                />
              </label>
              <label className="mt-3 block">
                <span className="text-xs font-medium text-slate-700">alt_kr</span>
                <textarea
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-xs"
                  rows={2}
                  value={altKr}
                  onChange={(e) => setAltKr(e.target.value)}
                />
              </label>
              <label className="mt-3 block">
                <span className="text-xs font-medium text-slate-700">alt_en</span>
                <textarea
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-xs"
                  rows={2}
                  value={altEn}
                  onChange={(e) => setAltEn(e.target.value)}
                />
              </label>
              <label className="mt-3 block">
                <span className="text-xs font-medium text-slate-700">seo_title_kr</span>
                <input
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-xs"
                  value={seoTitleKr}
                  onChange={(e) => setSeoTitleKr(e.target.value)}
                />
              </label>
              <label className="mt-3 block">
                <span className="text-xs font-medium text-slate-700">seo_title_en</span>
                <input
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-xs"
                  value={seoTitleEn}
                  onChange={(e) => setSeoTitleEn(e.target.value)}
                />
              </label>
              <label className="mt-4 flex items-center gap-2">
                <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
                <span className="text-sm">대표 이미지</span>
              </label>
              <label className="mt-3 block">
                <span className="text-xs font-medium text-slate-700">sort_order</span>
                <input
                  type="number"
                  className="mt-1 w-32 rounded border border-slate-300 px-2 py-1.5"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                />
              </label>
            </>
          )}

          {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}

          <div className="mt-6 flex gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
              취소
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
