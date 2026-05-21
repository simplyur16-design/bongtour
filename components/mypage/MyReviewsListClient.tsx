'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { MypageReviewRow } from '@/app/api/mypage/reviews/route'
import MypagePageHeading from '@/components/mypage/MypagePageHeading'

export default function MyReviewsListClient() {
  const [rows, setRows] = useState<MypageReviewRow[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch('/api/mypage/reviews', { cache: 'no-store' })
      const j = (await res.json()) as { ok?: boolean; reviews?: MypageReviewRow[]; error?: string }
      if (res.status === 401) {
        setErr('로그인이 필요합니다.')
        setRows([])
        return
      }
      if (!res.ok || !j.ok) throw new Error(j.error ?? '목록을 불러오지 못했습니다.')
      setRows(j.reviews ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : '오류')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <main className="mx-auto max-w-2xl py-2">
      <MypagePageHeading
        title="내 여행 후기"
        description="작성·수정한 후기 목록입니다. 검토 대기·반려 건만 수정할 수 있습니다."
      />

      <Link
        href="/mypage/reviews/write"
        className="mb-6 inline-flex rounded-full bg-[#534AB7] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4339A0]"
      >
        새 후기 작성
      </Link>

      {loading ? (
        <p className="text-sm text-[#534AB7]">불러오는 중…</p>
      ) : err ? (
        <p className="text-sm text-red-600">{err}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[#DAD4EE] bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-[15px] text-[#534AB7]">작성한 후기가 없습니다.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const created = new Date(row.created_at).toLocaleString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            })
            return (
              <li
                key={row.id}
                className="rounded-2xl border border-[#DAD4EE] bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#534AB7]">
                      {row.trip_line_label} · {row.review_type_label}
                    </p>
                    <p className="mt-1 font-semibold text-[#1F1B2D]">{row.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-[#534AB7]/90">{row.excerpt}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-[#DAD4EE] bg-[#EFEDF8] px-2.5 py-1 text-xs font-semibold text-[#534AB7]">
                    {row.status_label}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[#534AB7]/80">{created}</p>
                {row.status === 'rejected' && row.rejection_reason ? (
                  <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                    반려 사유: {row.rejection_reason}
                  </p>
                ) : null}
                {row.can_edit ? (
                  <Link
                    href={`/mypage/reviews/write?edit=${encodeURIComponent(row.id)}`}
                    className="mt-3 inline-block text-sm font-semibold text-[#534AB7] hover:text-[#1F1B2D]"
                  >
                    수정하기
                  </Link>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
