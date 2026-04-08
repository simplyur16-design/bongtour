'use client'

import { useMemo, useState } from 'react'
import type {
  RegisterCorrectionShoppingPreviewV1,
  RegisterCorrectionShoppingFieldV1,
  RegisterCorrectionShoppingPlaceRowV1,
  ReviewState,
} from '@/lib/register-correction-types-hanatour'

const REVIEW_LABELS: Record<ReviewState, string> = {
  auto: '자동',
  needs_review: '검수 필요',
  manually_edited: '수동 교정',
  approved: '승인',
}

type Props = {
  shoppingPreview: RegisterCorrectionShoppingPreviewV1
  initial: RegisterCorrectionShoppingFieldV1 | null
  onCancel: () => void
  onSave: (next: RegisterCorrectionShoppingFieldV1) => void
}

function cloneRows(rows: RegisterCorrectionShoppingPlaceRowV1[]): RegisterCorrectionShoppingPlaceRowV1[] {
  return rows.map((r) => ({
    ...r,
    auto: { ...r.auto },
    final: { ...r.final },
    evidence: { ...r.evidence },
  }))
}

function toManual(rs: ReviewState): ReviewState {
  return rs === 'auto' ? 'manually_edited' : rs
}

export default function RegisterShoppingCorrectionEditor({ shoppingPreview, initial, onCancel, onSave }: Props) {
  const seed = useMemo<RegisterCorrectionShoppingFieldV1>(() => {
    if (initial?.visitCount && initial?.places) return initial
    return {
      visitCount: shoppingPreview.visitCount,
      places: shoppingPreview.places,
    }
  }, [initial, shoppingPreview])

  const [visitFinal, setVisitFinal] = useState<number | ''>(seed.visitCount.final ?? '')
  const [visitReview, setVisitReview] = useState<ReviewState>(seed.visitCount.reviewState ?? 'needs_review')
  const [rows, setRows] = useState<RegisterCorrectionShoppingPlaceRowV1[]>(cloneRows(seed.places.rows))
  const [placesReview, setPlacesReview] = useState<ReviewState>(seed.places.reviewState ?? 'needs_review')

  const rowCount = rows.length

  function updateRow(idx: number, patch: Partial<RegisterCorrectionShoppingPlaceRowV1['final']>) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r
        return {
          ...r,
          final: { ...r.final, ...patch },
          reviewState: toManual(r.reviewState),
        }
      })
    )
    setPlacesReview((p) => toManual(p))
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx))
    setPlacesReview((p) => toManual(p))
  }

  function addRow() {
    const n = rows.length + 1
    setRows((prev) => [
      ...prev,
      {
        id: `manual_row_${Date.now()}_${n}`,
        auto: { itemType: '', placeName: '', durationText: null, refundPolicyText: null, raw: null },
        final: { itemType: '', placeName: '', durationText: null, refundPolicyText: null, raw: null },
        reviewState: 'manually_edited',
        evidence: { sourceKind: 'manual_row', sourceSummary: '관리자 수동 추가 행' },
      },
    ])
    setPlacesReview((p) => toManual(p))
  }

  function handleSave() {
    const vc = visitFinal === '' ? null : Number(visitFinal)
    if (vc != null && !Number.isFinite(vc)) {
      alert('방문 횟수는 숫자이거나 비워 두어야 합니다.')
      return
    }
    onSave({
      visitCount: {
        ...seed.visitCount,
        final: vc,
        reviewState: toManual(visitReview),
      },
      places: {
        ...seed.places,
        rows,
        reviewState: toManual(placesReview),
      },
    })
  }

  return (
    <div className="space-y-4 text-sm text-slate-800">
      {shoppingPreview.separationNote ? (
        <p className="rounded border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
          {shoppingPreview.separationNote}
        </p>
      ) : null}

      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <p>
          <strong>원칙:</strong> `shoppingVisitCount`(요약 방문 횟수)와 `shoppingPlaces[]`(상세 리스트)는 분리합니다.
        </p>
        <p className="mt-1">리스트 행 수를 방문 횟수로 자동 환산하지 않으며, 서로 자동 동기화하지 않습니다.</p>
      </div>

      <section className="rounded border border-slate-200 p-3">
        <p className="font-semibold text-slate-900">쇼핑 방문 횟수 편집기</p>
        <p className="mt-1 text-[11px] text-slate-500">
          auto: <span className="font-mono">{seed.visitCount.auto ?? '—'}</span>
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-semibold text-slate-700">최종 방문 횟수 (final)</label>
            <input
              type="number"
              min={0}
              value={visitFinal}
              onChange={(e) => setVisitFinal(e.target.value === '' ? '' : Number(e.target.value))}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-700">검수 상태 (review)</label>
            <select
              value={visitReview}
              onChange={(e) => setVisitReview(e.target.value as ReviewState)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              {(Object.keys(REVIEW_LABELS) as ReviewState[]).map((k) => (
                <option key={k} value={k}>
                  {REVIEW_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {(seed.visitCount.evidence.rawSnippet || seed.visitCount.evidence.sourceSummary) && (
          <div className="mt-2 rounded border border-slate-200 bg-white p-2 text-[11px] text-slate-600">
            {seed.visitCount.evidence.sourceSummary ? <p>{seed.visitCount.evidence.sourceSummary}</p> : null}
            {seed.visitCount.evidence.rawSnippet ? (
              <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap">{seed.visitCount.evidence.rawSnippet}</pre>
            ) : null}
          </div>
        )}
      </section>

      <section className="rounded border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-slate-900">쇼핑 상세 리스트 편집기</p>
          <button
            type="button"
            onClick={addRow}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold"
          >
            행 추가
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          auto row count: <span className="font-mono">{shoppingPreview.places.autoTableRowCount ?? '—'}</span> / final row count:{' '}
          <span className="font-mono">{rowCount}</span>
        </p>
        <div className="mt-2">
          <label className="text-[11px] font-semibold text-slate-700">리스트 검수 상태 (review)</label>
          <select
            value={placesReview}
            onChange={(e) => setPlacesReview(e.target.value as ReviewState)}
            className="mt-1 w-full max-w-xs rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            {(Object.keys(REVIEW_LABELS) as ReviewState[]).map((k) => (
              <option key={k} value={k}>
                {REVIEW_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 space-y-3">
          {rows.map((r, i) => (
            <div key={r.id} className="rounded border border-slate-200 bg-slate-50 p-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-slate-700">행 {i + 1}</p>
                <div className="flex items-center gap-2">
                  <select
                    value={r.reviewState}
                    onChange={(e) => {
                      const next = e.target.value as ReviewState
                      setRows((prev) => prev.map((x, ix) => (ix === i ? { ...x, reviewState: next } : x)))
                    }}
                    className="rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px]"
                  >
                    {(Object.keys(REVIEW_LABELS) as ReviewState[]).map((k) => (
                      <option key={k} value={k}>
                        {REVIEW_LABELS[k]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="rounded border border-red-300 bg-white px-2 py-1 text-[11px] text-red-700"
                  >
                    삭제
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={r.final.itemType}
                  onChange={(e) => updateRow(i, { itemType: e.target.value })}
                  placeholder="품목(itemType)"
                  className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                />
                <input
                  value={r.final.placeName}
                  onChange={(e) => updateRow(i, { placeName: e.target.value })}
                  placeholder="장소(placeName)"
                  className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                />
                <input
                  value={r.final.durationText ?? ''}
                  onChange={(e) => updateRow(i, { durationText: e.target.value || null })}
                  placeholder="소요시간(durationText)"
                  className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                />
                <input
                  value={r.final.refundPolicyText ?? ''}
                  onChange={(e) => updateRow(i, { refundPolicyText: e.target.value || null })}
                  placeholder="환불정책(refundPolicyText)"
                  className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                />
                <textarea
                  value={r.final.raw ?? ''}
                  onChange={(e) => updateRow(i, { raw: e.target.value || null })}
                  placeholder="raw 원문(선택)"
                  className="sm:col-span-2 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                  rows={2}
                />
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                auto: {r.auto.itemType || '—'} / {r.auto.placeName || '—'} / {r.auto.durationText || '—'}
              </p>
            </div>
          ))}
        </div>

        {(shoppingPreview.places.evidence.rawSnippet || shoppingPreview.places.evidence.sourceSummary) && (
          <div className="mt-3 rounded border border-slate-200 bg-white p-2 text-[11px] text-slate-600">
            {shoppingPreview.places.evidence.sourceSummary ? <p>{shoppingPreview.places.evidence.sourceSummary}</p> : null}
            {shoppingPreview.places.evidence.rawSnippet ? (
              <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap">{shoppingPreview.places.evidence.rawSnippet}</pre>
            ) : null}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
        <button type="button" onClick={handleSave} className="rounded-lg bg-[#0f172a] px-4 py-2 text-sm font-semibold text-white">
          교정 반영
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
          취소
        </button>
      </div>
    </div>
  )
}
