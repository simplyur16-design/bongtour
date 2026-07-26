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

export default function AffiliationCardsAdminClient() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [noteById, setNoteById] = useState<Record<string, string>>({})

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
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              status === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {s}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto rounded-md border px-3 py-1.5 text-sm"
        >
          새로고침
        </button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">불러오는 중…</p>}

      {!loading && items.length === 0 && (
        <p className="text-sm text-slate-500">해당 상태의 요청이 없습니다.</p>
      )}

      <ul className="space-y-6">
        {items.map((it) => (
          <li key={it.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.imageUrl}
                alt="명함"
                className="max-h-56 w-full rounded-lg object-contain bg-slate-50"
              />
              <div className="space-y-2 text-sm">
                <div className="font-medium text-slate-900">
                  {it.userName || '(이름 없음)'} · {it.userEmail || it.userId}
                </div>
                <div className="text-slate-600">상태: {it.status}</div>
                <div className="text-slate-600">접수: {new Date(it.createdAt).toLocaleString('ko-KR')}</div>
                <dl className="grid grid-cols-[5rem_1fr] gap-y-1 text-slate-700">
                  <dt>회사</dt>
                  <dd>{it.ocrCompany || '-'}</dd>
                  <dt>이름</dt>
                  <dd>{it.ocrName || '-'}</dd>
                  <dt>직함</dt>
                  <dd>{it.ocrPosition || '-'}</dd>
                  <dt>이메일</dt>
                  <dd>{it.ocrEmail || '-'}</dd>
                  <dt>전화</dt>
                  <dd>{it.ocrPhone || it.userPhone || '-'}</dd>
                </dl>

                {it.status === 'pending' && (
                  <div className="space-y-2 pt-2">
                    <textarea
                      value={noteById[it.id] ?? ''}
                      onChange={(e) =>
                        setNoteById((prev) => ({ ...prev, [it.id]: e.target.value }))
                      }
                      placeholder="관리자 메모(반려 사유 등)"
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === it.id}
                        onClick={() => void review(it.id, 'approve')}
                        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        승인 → 할인 적용
                      </button>
                      <button
                        type="button"
                        disabled={busyId === it.id}
                        onClick={() => void review(it.id, 'reject')}
                        className="rounded-md bg-rose-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        반려
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
