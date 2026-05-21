'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { MypageInquiryRow } from '@/app/api/mypage/inquiries/route'
import MypagePageHeading from '@/components/mypage/MypagePageHeading'

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'received':
      return 'bg-[#EFEDF8] text-[#534AB7] border-[#DAD4EE]'
    case 'reviewing':
    case 'contacting':
      return 'bg-amber-50 text-amber-950 border-amber-200'
    case 'contacted':
    case 'quoted':
    case 'scheduled':
      return 'bg-emerald-50 text-emerald-900 border-emerald-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

export default function MyInquiriesClient() {
  const [rows, setRows] = useState<MypageInquiryRow[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch('/api/mypage/inquiries', { cache: 'no-store' })
      const j = (await res.json()) as { ok?: boolean; inquiries?: MypageInquiryRow[]; error?: string }
      if (res.status === 401) {
        setErr('로그인이 필요합니다.')
        setRows([])
        return
      }
      if (!res.ok || !j.ok) throw new Error(j.error ?? '목록을 불러오지 못했습니다.')
      setRows(j.inquiries ?? [])
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
        title="문의 이력"
        description="봉투어에 접수하신 상담·견적 문의 내역입니다."
      />

      {loading ? (
        <p className="text-sm text-[#534AB7]">불러오는 중…</p>
      ) : err ? (
        <div className="rounded-2xl border border-[#DAD4EE] bg-white p-5 text-sm text-[#534AB7]">
          <p>{err}</p>
          <Link
            href="/auth/signin?callbackUrl=/mypage/inquiries"
            className="mt-3 inline-block font-semibold text-[#534AB7] underline"
          >
            로그인
          </Link>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[#DAD4EE] bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-[15px] text-[#534AB7]">접수된 문의가 없습니다.</p>
          <Link
            href="/inquiry?type=travel"
            className="mt-4 inline-block rounded-full bg-[#534AB7] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4339A0]"
          >
            상담 신청하기
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const title = row.snapshotProductTitle ?? row.snapshotCardLabel ?? row.inquiryTypeLabel
            const created = new Date(row.createdAt).toLocaleString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
            return (
              <li
                key={row.id}
                className="rounded-2xl border border-[#DAD4EE] bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#534AB7]">{row.inquiryNumber}</p>
                    <p className="mt-1 font-semibold text-[#1F1B2D]">{title}</p>
                    <p className="mt-1 text-sm text-[#534AB7]">{row.inquiryTypeLabel}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}
                  >
                    {row.statusLabel}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[#534AB7]/80">{created}</p>
                {row.message?.trim() ? (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg bg-[#F5F2EA] px-3 py-2 text-sm text-[#1F1B2D]">
                    {row.message.trim()}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
