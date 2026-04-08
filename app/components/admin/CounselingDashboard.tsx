'use client'

import { useState, useEffect } from 'react'

export type CounselingPoint = {
  title: string
  content: string
  script: string
}

export type CounselingNotesData = {
  counseling_points: CounselingPoint[]
}

type Props = {
  productId: number
  counselingNotes: CounselingNotesData | null
  criticalExclusions: string | null
  mandatoryLocalFee: number | null
  mandatoryCurrency: string | null
  onUpdate?: () => void
}

export default function CounselingDashboard({
  productId,
  counselingNotes: initialNotes,
  criticalExclusions: initialCritical,
  mandatoryLocalFee,
  mandatoryCurrency,
  onUpdate,
}: Props) {
  const [counselingNotes, setCounselingNotes] = useState<CounselingNotesData | null>(
    initialNotes ? { counseling_points: [...initialNotes.counseling_points] } : null
  )
  const [criticalExclusions, setCriticalExclusions] = useState(initialCritical ?? '')
  const [modalPoint, setModalPoint] = useState<CounselingPoint | null>(null)
  const points = counselingNotes?.counseling_points ?? []
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setCounselingNotes(initialNotes ? { counseling_points: [...initialNotes.counseling_points] } : null)
    setCriticalExclusions(initialCritical ?? '')
  }, [productId, initialNotes, initialCritical])

  const quickSummaryItems: string[] = []
  if (criticalExclusions.trim()) {
    quickSummaryItems.push(...criticalExclusions.split(/[,，]/).map((s) => s.trim()).filter(Boolean))
  }
  while (quickSummaryItems.length < 3 && points.length > 0) {
    const next = points[quickSummaryItems.length]
    if (next) quickSummaryItems.push(next.title)
    else break
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counselingNotes: counselingNotes
            ? { counseling_points: counselingNotes.counseling_points }
            : null,
          criticalExclusions: criticalExclusions.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('저장 실패')
      onUpdate?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 p-1">
      <h2 className="text-base font-semibold tracking-tight text-[#0f172a]">AI 상담 대시보드</h2>

      <div className="border border-gray-200 p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">이 상품 상담 시 주의사항 3가지</p>
        <ul className="space-y-2 text-sm text-[#0f172a]">
          {(quickSummaryItems.length > 0 ? quickSummaryItems : ['등록된 주의사항이 없습니다.']).slice(0, 3).map((item, i) => (
            <li key={i} className="border-l-4 border-[#0f172a] pl-3">
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-5">
          <label htmlFor="counseling-critical-exclusions" className="mb-2 block text-xs font-medium tracking-wide text-gray-600">핵심 요약 수정 (쉼표 구분)</label>
          <input
            id="counseling-critical-exclusions"
            name="criticalExclusions"
            type="text"
            value={criticalExclusions}
            onChange={(e) => setCriticalExclusions(e.target.value)}
            placeholder="가이드비 $30, 유류세 변동 가능"
            className="w-full border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="border border-gray-200 p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-600">상담 안내</p>
        <ul className="space-y-2">
          {points.length === 0 ? (
            <li className="text-sm text-gray-500">없음</li>
          ) : (
            points.map((p, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setModalPoint(p)}
                  className="text-left text-sm font-medium underline hover:no-underline"
                >
                  {p.title}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      {modalPoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setModalPoint(null)}>
          <div className="w-full max-w-lg border border-gray-200 bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">상담 안내</span>
              <button type="button" onClick={() => setModalPoint(null)} className="text-sm text-gray-500 hover:text-gray-800">
                닫기
              </button>
            </div>
            <h3 className="font-semibold text-[#0f172a]">{modalPoint.title}</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{modalPoint.content}</p>
            {modalPoint.script && (
              <div className="mt-4 border-b border-dotted border-[#fde68a] pb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">추천 상담 멘트</p>
                <p className="mt-2 text-sm text-gray-800">&ldquo;{modalPoint.script}&rdquo;</p>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="border border-[#0f172a] bg-[#0f172a] px-5 py-3 text-sm font-medium text-white hover:bg-[#1e293b] disabled:opacity-50"
      >
        {saving ? '저장 중…' : '상담 노트 저장'}
      </button>
    </div>
  )
}
