'use client'

import { useCallback, useEffect, useState } from 'react'

type Item = {
  id: string
  userId: string
  userName: string | null
  userEmail: string | null
  userPhone: string | null
  status: string
  imageUrl: string
  ocrName: string | null
  ocrCompany: string | null
  ocrEmail: string | null
  ocrPhone: string | null
  ocrPosition: string | null
  adminNote: string | null
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  approved: '승인',
  rejected: '반려',
  all: '전체',
}

export default function AffiliationCardsAdminClient() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [noteById, setNoteById] = useState<Record<string, string>>({})
  const [lightbox, setLightbox] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/affiliation-cards?status=${status}`)
      const data = (await res.json()) as { ok?: boolean; items?: Item[]; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error || '목록을 불러오지 못했습니다.')
        setItems([])
        return
      }
      setItems(data.items ?? [])
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  async function review(id: string, decision: 'approve' | 'reject') {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/affiliation-cards/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, adminNote: noteById[id] || null }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error || '처리 실패')
        return
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-3 md:space-y-4" data-admin-affiliation-mobile="true">
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium ${
              status === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'
            }`}
          >
            {STATUS_LABEL[s] ?? s}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto shrink-0 rounded-full px-3.5 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
        >
          새로고침
        </button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">불러오는 중…</p>}

      {!loading && items.length === 0 && (
        <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          해당 상태의 요청이 없습니다.
        </p>
      )}

      <ul className="space-y-4">
        {items.map((it) => (
          <li
            key={it.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <button
              type="button"
              className="block w-full bg-slate-50"
              onClick={() => setLightbox(it.imageUrl)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.imageUrl}
                alt="명함"
                className="mx-auto max-h-[42vh] w-full object-contain md:max-h-64"
              />
              <span className="block py-1 text-center text-[11px] text-slate-500">탭하면 확대</span>
            </button>

            <div className="space-y-3 p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-slate-900">
                    {it.userName || '(이름 없음)'}
                  </div>
                  <div className="truncate text-xs text-slate-500">{it.userEmail || it.userId}</div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    it.status === 'pending'
                      ? 'bg-amber-100 text-amber-900'
                      : it.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-rose-100 text-rose-900'
                  }`}
                >
                  {STATUS_LABEL[it.status] ?? it.status}
                </span>
              </div>

              <div className="text-xs text-slate-500">
                접수 {new Date(it.createdAt).toLocaleString('ko-KR')}
              </div>

              <dl className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1.5 text-sm text-slate-800">
                <dt className="text-slate-500">회사</dt>
                <dd className="break-words font-medium">{it.ocrCompany || '-'}</dd>
                <dt className="text-slate-500">이름</dt>
                <dd className="break-words">{it.ocrName || '-'}</dd>
                <dt className="text-slate-500">직함</dt>
                <dd className="break-words">{it.ocrPosition || '-'}</dd>
                <dt className="text-slate-500">이메일</dt>
                <dd className="break-all">{it.ocrEmail || '-'}</dd>
                <dt className="text-slate-500">전화</dt>
                <dd>
                  {it.ocrPhone || it.userPhone ? (
                    <a
                      href={`tel:${(it.ocrPhone || it.userPhone || '').replace(/\s/g, '')}`}
                      className="font-medium text-[#5B4B8A] underline"
                    >
                      {it.ocrPhone || it.userPhone}
                    </a>
                  ) : (
                    '-'
                  )}
                </dd>
              </dl>

              {it.status === 'pending' && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <textarea
                    value={noteById[it.id] ?? ''}
                    onChange={(e) =>
                      setNoteById((prev) => ({ ...prev, [it.id]: e.target.value }))
                    }
                    placeholder="관리자 메모(반려 사유 등)"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base sm:text-sm"
                    rows={2}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busyId === it.id}
                      onClick={() => void review(it.id, 'reject')}
                      className="min-h-12 rounded-xl bg-rose-700 px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      반려
                    </button>
                    <button
                      type="button"
                      disabled={busyId === it.id}
                      onClick={() => void review(it.id, 'approve')}
                      className="min-h-12 rounded-xl bg-emerald-700 px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      승인 · 할인
                    </button>
                  </div>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-3"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0"
            aria-label="닫기"
            onClick={() => setLightbox(null)}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="명함 확대"
            className="relative z-[1] max-h-[90vh] max-w-full object-contain"
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute bottom-6 left-1/2 z-[2] -translate-x-1/2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900"
          >
            닫기
          </button>
        </div>
      )}
    </div>
  )
}
