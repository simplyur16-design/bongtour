'use client'

import { useEffect, useState } from 'react'
import {
  BRIEFING_SOURCE_TYPES,
  CURATION_PUBLISH_STATUSES,
  type AdminMonthlyCurationListItem,
} from '@/lib/admin-curation'
import { CURATION_SCOPES } from '@/lib/monthly-curation'
import { CUSTOMER_INQUIRY_TYPES } from '@/lib/customer-inquiry-intake'

export type EditorMode = 'create' | 'edit'

type Props = {
  open: boolean
  mode: EditorMode
  /** create 시 URL 필터에서 넘긴 기본값 */
  defaults?: { yearMonth: string; scope: string }
  /** create 시 목록 첫 행 등에서 텍스트·유형만 복사 */
  prefillFrom?: AdminMonthlyCurationListItem | null
  /** edit 시 행 */
  row?: AdminMonthlyCurationListItem | null
  onClose: () => void
  onSaved: () => void
}

const emptyForm = {
  yearMonth: '',
  scope: 'domestic' as string,
  destinationName: '',
  oneLineTheme: '',
  whyNowText: '',
  recommendedForText: '',
  leadTimeLabel: '',
  primaryInquiryType: 'travel_consult',
  briefingSourceType: 'bongtour_editorial',
  linkedProductId: '',
  sortOrder: '0',
  status: 'draft',
  isActive: true,
}

export default function MonthlyCurationEditor({ open, mode, defaults, prefillFrom, row, onClose, onSaved }: Props) {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setError(null)
    setFieldErrors({})
    if (mode === 'create') {
      const ym = defaults?.yearMonth ?? emptyForm.yearMonth
      const sc =
        defaults?.scope && (defaults.scope === 'domestic' || defaults.scope === 'overseas') ? defaults.scope : 'domestic'
      if (prefillFrom) {
        setForm({
          yearMonth: ym,
          scope: sc,
          destinationName: prefillFrom.destinationName,
          oneLineTheme: prefillFrom.oneLineTheme,
          whyNowText: prefillFrom.whyNowText,
          recommendedForText: prefillFrom.recommendedForText,
          leadTimeLabel: prefillFrom.leadTimeLabel,
          primaryInquiryType: prefillFrom.primaryInquiryType,
          briefingSourceType: prefillFrom.briefingSourceType,
          linkedProductId: prefillFrom.linkedProductId ?? '',
          sortOrder: String(prefillFrom.sortOrder),
          status: 'draft',
          isActive: true,
        })
      } else {
        setForm({
          ...emptyForm,
          yearMonth: ym,
          scope: sc,
        })
      }
    } else if (row) {
      setForm({
        yearMonth: row.yearMonth,
        scope: row.scope,
        destinationName: row.destinationName,
        oneLineTheme: row.oneLineTheme,
        whyNowText: row.whyNowText,
        recommendedForText: row.recommendedForText,
        leadTimeLabel: row.leadTimeLabel,
        primaryInquiryType: row.primaryInquiryType,
        briefingSourceType: row.briefingSourceType,
        linkedProductId: row.linkedProductId ?? '',
        sortOrder: String(row.sortOrder),
        status: row.status,
        isActive: row.isActive,
      })
    }
  }, [open, mode, defaults?.yearMonth, defaults?.scope, prefillFrom, row])

  if (!open) return null

  const set = (k: keyof typeof form, v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setFieldErrors({})
    const sortOrderNum = parseInt(form.sortOrder, 10)
    if (Number.isNaN(sortOrderNum) || !Number.isInteger(sortOrderNum)) {
      setFieldErrors({ sortOrder: '정수를 입력하세요.' })
      setSaving(false)
      return
    }

    const linkedTrim = form.linkedProductId.trim()
    const linkedPayload = linkedTrim === '' ? null : linkedTrim

    try {
      if (mode === 'create') {
        const res = await fetch('/api/admin/curations/monthly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            yearMonth: form.yearMonth.trim(),
            scope: form.scope,
            destinationName: form.destinationName,
            oneLineTheme: form.oneLineTheme,
            whyNowText: form.whyNowText,
            recommendedForText: form.recommendedForText,
            leadTimeLabel: form.leadTimeLabel,
            primaryInquiryType: form.primaryInquiryType,
            briefingSourceType: form.briefingSourceType,
            linkedProductId: linkedPayload,
            sortOrder: sortOrderNum,
            status: form.status,
            isActive: form.isActive,
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          item?: AdminMonthlyCurationListItem
          error?: string
          fieldErrors?: Record<string, string>
        }
        if (!res.ok) {
          setError(data.error ?? '저장에 실패했습니다.')
          if (data.fieldErrors) setFieldErrors(data.fieldErrors)
          return
        }
        if (data.item) onSaved()
        onClose()
      } else if (row) {
        const res = await fetch(`/api/admin/curations/monthly/${row.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            yearMonth: form.yearMonth.trim(),
            scope: form.scope,
            destinationName: form.destinationName,
            oneLineTheme: form.oneLineTheme,
            whyNowText: form.whyNowText,
            recommendedForText: form.recommendedForText,
            leadTimeLabel: form.leadTimeLabel,
            primaryInquiryType: form.primaryInquiryType,
            briefingSourceType: form.briefingSourceType,
            linkedProductId: linkedPayload,
            sortOrder: sortOrderNum,
            status: form.status,
            isActive: form.isActive,
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          item?: AdminMonthlyCurationListItem
          error?: string
          fieldErrors?: Record<string, string>
        }
        if (!res.ok) {
          setError(data.error ?? '저장에 실패했습니다.')
          if (data.fieldErrors) setFieldErrors(data.fieldErrors)
          return
        }
        if (data.item) onSaved()
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="curation-editor-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <h2 id="curation-editor-title" className="text-base font-semibold text-gray-900">
            {mode === 'create' ? '새 월별 큐레이션 카드' : '카드 수정'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            닫기
          </button>
        </div>

        <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-950">
          <p className="font-semibold">메인 노출 조건</p>
          <p className="mt-1 leading-relaxed">
            공개 API는 <code className="rounded bg-amber-100/80 px-1">status === published</code> 이고{' '}
            <code className="rounded bg-amber-100/80 px-1">isActive === true</code> 인 카드만 내려줍니다. 메인 페이지는 보통{' '}
            <strong>이번 달(서울)</strong>·<strong>국내/국외 스코프</strong>로 각각 요청하므로, 월·범위가 맞지 않으면 화면에 안
            나올 수 있습니다.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 p-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-gray-600">yearMonth (YYYY-MM)</label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                value={form.yearMonth}
                onChange={(e) => set('yearMonth', e.target.value)}
                required
              />
              {fieldErrors.yearMonth && <p className="mt-0.5 text-xs text-red-600">{fieldErrors.yearMonth}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">scope</label>
              <select
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                value={form.scope}
                onChange={(e) => set('scope', e.target.value)}
              >
                {CURATION_SCOPES.map((s) => (
                  <option key={s} value={s}>
                    {s === 'domestic' ? '국내 (domestic)' : '국외 (overseas)'}
                  </option>
                ))}
              </select>
              {fieldErrors.scope && <p className="mt-0.5 text-xs text-red-600">{fieldErrors.scope}</p>}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">목적지명</label>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              value={form.destinationName}
              onChange={(e) => set('destinationName', e.target.value)}
              required
            />
            {fieldErrors.destinationName && <p className="mt-0.5 text-xs text-red-600">{fieldErrors.destinationName}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">한 줄 테마</label>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              value={form.oneLineTheme}
              onChange={(e) => set('oneLineTheme', e.target.value)}
              required
            />
            {fieldErrors.oneLineTheme && <p className="mt-0.5 text-xs text-red-600">{fieldErrors.oneLineTheme}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">지금 가기 좋은 이유</label>
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              value={form.whyNowText}
              onChange={(e) => set('whyNowText', e.target.value)}
              required
            />
            {fieldErrors.whyNowText && <p className="mt-0.5 text-xs text-red-600">{fieldErrors.whyNowText}</p>}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">추천 대상</label>
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              value={form.recommendedForText}
              onChange={(e) => set('recommendedForText', e.target.value)}
              required
            />
            {fieldErrors.recommendedForText && (
              <p className="mt-0.5 text-xs text-red-600">{fieldErrors.recommendedForText}</p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">권장 상담 시점 문구</label>
            <textarea
              className="mt-1 min-h-[56px] w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              value={form.leadTimeLabel}
              onChange={(e) => set('leadTimeLabel', e.target.value)}
              required
            />
            {fieldErrors.leadTimeLabel && <p className="mt-0.5 text-xs text-red-600">{fieldErrors.leadTimeLabel}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-gray-600">문의 유형 (primaryInquiryType)</label>
              <select
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                value={form.primaryInquiryType}
                onChange={(e) => set('primaryInquiryType', e.target.value)}
              >
                {CUSTOMER_INQUIRY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {fieldErrors.primaryInquiryType && (
                <p className="mt-0.5 text-xs text-red-600">{fieldErrors.primaryInquiryType}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">출처 유형 (briefingSourceType)</label>
              <select
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                value={form.briefingSourceType}
                onChange={(e) => set('briefingSourceType', e.target.value)}
              >
                {BRIEFING_SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {fieldErrors.briefingSourceType && (
                <p className="mt-0.5 text-xs text-red-600">{fieldErrors.briefingSourceType}</p>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">연결 상품 ID (비우면 미연결)</label>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 font-mono text-xs"
              value={form.linkedProductId}
              onChange={(e) => set('linkedProductId', e.target.value)}
              placeholder="Product cuid"
            />
            {fieldErrors.linkedProductId && <p className="mt-0.5 text-xs text-red-600">{fieldErrors.linkedProductId}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-gray-600">sortOrder</label>
              <input
                type="number"
                step={1}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                value={form.sortOrder}
                onChange={(e) => set('sortOrder', e.target.value)}
              />
              {fieldErrors.sortOrder && <p className="mt-0.5 text-xs text-red-600">{fieldErrors.sortOrder}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">게시 상태 (status)</label>
              <select
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                {CURATION_PUBLISH_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {fieldErrors.status && <p className="mt-0.5 text-xs text-red-600">{fieldErrors.status}</p>}
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => set('isActive', e.target.checked)}
                  className="rounded border-gray-300"
                />
                활성 (isActive)
              </label>
              <p className="mt-1 text-[11px] text-gray-500">게시+활성 둘 다여야 메인 API 후보</p>
              {fieldErrors.isActive && <p className="mt-0.5 text-xs text-red-600">{fieldErrors.isActive}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
